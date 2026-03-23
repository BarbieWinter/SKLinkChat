/**
 * 应用核心：统一管理 HTTP 路由、WebSocket 生命周期、在线用户池、匹配队列和心跳检测。
 */
import { Server } from 'bun'
import { omit } from 'lodash'
import { IUser, PayloadType, UserState, WebSocket } from '../types'
import { Handler, MessageHandler, QueueHandler, UserHandler } from './handlers'
import Queue from './queue'
import { WebSocketResponse } from './response'
import User from './user'

export class App {
  reconnectWindowMs = 3 * 60 * 1000
  server: Server | null = null
  clients: Record<string, User> = {}
  heartbeat: ReturnType<typeof setInterval> | null = null
  matching: ReturnType<typeof setInterval> | null = null
  handlers: Handler[] = []
  queue: Queue<string> = new Queue()
  reconnectTimers: Record<string, ReturnType<typeof setTimeout>> = {}
  debug: boolean = true

  constructor() {
    // 把不同协议类型的处理逻辑拆到独立 Handler 中，降低主类复杂度。
    this.handlers = [MessageHandler, UserHandler, QueueHandler].map((HandlerClass) => new HandlerClass(this))
  }

  listen(port: number | string) {
    this.server = Bun.serve({
      port,
      fetch: (req, server) => {
        // 同一个 Bun 服务同时提供健康检查、在线人数接口和 WebSocket 升级入口。
        const url = new URL(req.url)
        switch (url.pathname) {
          case '/':
            return new Response(JSON.stringify({ health: 'ok' }), {
              headers: {
                'content-type': 'application/json'
              }
            })
          case '/ws':
            const sessionId = url.searchParams.get('sessionId')?.trim() || crypto.randomUUID()
            if (
              server.upgrade(req, {
                data: {
                  id: sessionId
                }
              })
            ) {
              return
            }
            return new Response('Upgrade failed :(', { status: 500 })
          case '/users':
            return new Response(
              JSON.stringify(Object.values(this.clients).filter((user) => user.isOnline).map((user) => omit(user, 'ws'))),
              {
              headers: {
                'content-type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
              }
            })
          default:
            return new Response('Not found', { status: 404 })
        }
      },
      websocket: {
        open: (ws: WebSocket) => {
          console.info('Client connected', ws.data.id)
          const existingClient = this.clients[ws.data.id]

          if (existingClient) {
            this.clearReconnectTimer(existingClient.id)
            existingClient.attachSocket(ws)
            ws.send(new WebSocketResponse(PayloadType.UserInfo, existingClient.serialize()).json())

            if (existingClient.state === UserState.Searching && !this.queue.includes(existingClient.id)) {
              this.queue.push(existingClient.id)
            }

            if (existingClient.state === UserState.Connected) {
              const partnerId = existingClient.history[existingClient.history.length - 1]
              const partner = partnerId ? this.client(partnerId) : null
              if (partner) {
                ws.send(new WebSocketResponse(PayloadType.Match, partner.serialize()).json())
              }
            }

            return
          }

          this.clients[ws.data.id] = new User(ws.data.id, ws)
          ws.send(new WebSocketResponse(PayloadType.UserInfo, this.clients[ws.data.id].serialize()).json())
        },
        close: (ws: WebSocket) => {
          console.info('Client disconnected', ws.data.id)
          this.suspendClient(ws.data.id)
        },
        message: (ws: WebSocket, message) => {
          const payload = JSON.parse(message as string)
          this.handlers.forEach((handler) => handler.listen(ws, payload))
        },
        pong: (ws) => {
          // 收到 pong 说明连接仍然存活，用于配合心跳机制清理失效客户端。
          const client = this.clients[ws.data.id]
          if (!client) return
          this.clients[ws.data.id].isAlive = true
        }
      }
    })

    this.heartbeat = setInterval(() => {
      // 心跳循环：定时 ping 客户端，清除没有及时 pong 的失效连接。
      Object.values(this.clients).forEach((client) => {
        if (!client.ws) {
          if (client.reconnectDeadline && client.reconnectDeadline <= Date.now()) {
            this.removeClient(client.id)
          }
          return
        }

        if (!client.isAlive) {
          console.info('Client', client.id, 'is dead, removing from clients')
          this.suspendClient(client.id)
          return
        }
        client.isAlive = false
        client.ws?.ping()
      })
    }, 5_000)

    this.matching = setInterval(() => {
      // 匹配循环：每隔一段时间从队列中取出两个用户尝试建立会话。
      if (this.queue.length < 2) return

      const user1_id = this.queue.shift() as string
      const user2_id = this.queue.shift() as string

      const user1 = this.client(user1_id)
      const user2 = this.client(user2_id)

      console.debug('Matching: ', {
        user1: user1?.serialize(),
        user2: user2?.serialize()
      })

      if (!user1 || !user2 || !user1.isOnline || !user2.isOnline || !user1.canConnect(user2)) {
        console.error('User not found in clients or cannot connect.')
        // 配对失败时把还能继续匹配的用户重新放回队列。
        if (user1?.isOnline) this.queue.push(user1_id)
        if (user2?.isOnline) this.queue.push(user2_id)
        return
      }

      user1.connect(user2)
      user2.connect(user1)
    }, 2_500)

    console.info('> Listening on port', port)
  }

  updateClient(id: string, data: Partial<IUser>) {
    // 更新指定用户的状态或资料。
    if (!this.clients[id]) return
    this.clients[id].update(data)
  }

  clearReconnectTimer(id: string) {
    if (!this.reconnectTimers[id]) return
    clearTimeout(this.reconnectTimers[id])
    delete this.reconnectTimers[id]
  }

  suspendClient(id: string) {
    const client = this.client(id)
    if (!client || !client.isOnline) return

    this.queue.delete(id)
    client.markDisconnected(this.reconnectWindowMs)
    this.clearReconnectTimer(id)
    this.reconnectTimers[id] = setTimeout(() => {
      const currentClient = this.client(id)
      if (!currentClient?.isOnline) {
        this.removeClient(id)
      }
    }, this.reconnectWindowMs)
  }

  removeClient(id: string) {
    // 客户端离线时需要同时移出匹配队列，并处理其当前聊天对象的断开通知。
    const client = this.client(id)
    if (!client) return

    this.clearReconnectTimer(id)
    this.queue.delete(id)

    if (client.state === UserState.Connected) {
      const partnerId = client.history[client.history.length - 1]
      const partner = partnerId ? this.client(partnerId) : null

      partner?.disconnect()
      if (partner) {
        this.queue.delete(partner.id)
      }
    }

    delete this.clients[id]
  }

  client(id: string) {
    return this.clients[id] ?? null
  }

  stop() {
    Object.values(this.clients).forEach((client) => client.ws?.close())
    this.server?.stop(true)
    clearInterval(this.heartbeat || undefined)
  }
}

export default new App()
