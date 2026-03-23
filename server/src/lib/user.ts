/**
 * 用户领域模型：封装连接用户的昵称、状态、历史配对记录和与客户端的同步行为。
 */
import { IUser, PayloadType, UserState, WebSocket } from '@/types'
import { generateUsername } from 'unique-username-generator'
import { WebSocketResponse } from './response'

class User implements IUser {
  id: string
  name?: string | undefined
  state: UserState
  ws: WebSocket | null
  isAlive: boolean
  history: string[] = []
  isTyping: boolean = false
  disconnectedAt: number | null = null
  reconnectDeadline: number | null = null

  constructor(id: string, ws: WebSocket) {
    this.id = id
    this.ws = ws
    this.state = UserState.Idle
    this.isAlive = true
    this.name = generateUsername()
  }

  attachSocket(ws: WebSocket) {
    this.ws = ws
    this.isAlive = true
    this.disconnectedAt = null
    this.reconnectDeadline = null
  }

  markDisconnected(reconnectWindowMs: number) {
    this.ws = null
    this.isAlive = false
    this.disconnectedAt = Date.now()
    this.reconnectDeadline = this.disconnectedAt + reconnectWindowMs
  }

  get isOnline() {
    return this.ws !== null
  }

  update(user: Partial<IUser>) {
    Object.assign(this, user)

    // 每次用户资料更新后，都立即把最新信息回推给前端，保证界面状态一致。
    this.ws?.send(
      new WebSocketResponse(PayloadType.UserInfo, {
        id: this.id,
        name: this.name,
        state: this.state
      }).json()
    )
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      state: this.state
    }
  }

  canConnect(stranger: User) {
    return stranger.id !== this.id && !this.history.includes(stranger.id)
  }

  connect(stranger: User) {
    // 记录配对历史，避免短时间内被重复匹配到同一个对象。
    if (this.history[this.history.length - 1] !== stranger.id) {
      this.history.push(stranger.id)
    }
    this.update({ state: UserState.Connected })
    this.ws?.send(new WebSocketResponse(PayloadType.Match, stranger.serialize()).json())
  }

  disconnect() {
    // 断开时返回最近一次聊天对象，方便上层同步处理另一端的断连。
    this.update({ state: UserState.Idle })
    this.ws?.send(new WebSocketResponse(PayloadType.Disconnect, null).json())
    return this.history[this.history.length - 1]
  }
}

export default User
