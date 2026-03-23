/**
 * 匹配队列处理器：处理开始匹配、重新匹配和与当前对象断开的流程。
 */
import { PayloadType, UserState, WebSocket, WebSocketPayload } from '@/types'
import Handler from './handler'

interface QueuePayload {
  id: string
}

export default class QueueHandler extends Handler {
  types = [PayloadType.Queue]

  handle(ws: WebSocket, payload: WebSocketPayload) {
    if (this.app.debug) console.debug('Queue request received', payload)

    const { id } = payload.payload as QueuePayload
    const client = this.app.client(id)

    if (!client) {
      ws.send(JSON.stringify({ type: 'error', payload: 'Client not found' }))
      return
    }

    // 根据当前状态决定是忽略、断开当前会话后重排，还是直接加入匹配队列。
    switch (client.state) {
      case UserState.Searching:
        return
      case UserState.Connected:
        // 已连接状态下再次点击匹配，表示断开当前对象并重新排队。
        const lastUserId = client.disconnect()
        if (lastUserId) {
          const lastUser = this.app.client(lastUserId)
          lastUser?.disconnect()
        }
      // 这里故意不写 break，让已连接用户断开后继续执行“重新加入队列”。
      default:
        // 进入搜索状态并加入待匹配队列。
        this.app.updateClient(id, { state: UserState.Searching })
        this.app.queue.push(id)
        break
    }
  }
}
