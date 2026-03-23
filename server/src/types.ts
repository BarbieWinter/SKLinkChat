/**
 * 后端协议与连接类型定义：统一 WebSocket 数据、消息体和用户状态枚举。
 */
import { ServerWebSocket } from 'bun'

export type WebSocketData = {
  id: string
}

export type WebSocket = ServerWebSocket<WebSocketData>

export type WebSocketPayload = {
  type: PayloadType
  payload: unknown
}

export interface IUser {
  id: string
  name?: string
  state: UserState
  ws: WebSocket | null
  isAlive: boolean
}

export enum UserState {
  Idle = 'idle',
  Searching = 'searching',
  Connected = 'connected'
}

export enum PayloadType {
  Message = 'message',
  UserInfo = 'user-info',
  Error = 'error',
  Call = 'call',
  Queue = 'queue',
  Match = 'match',
  Disconnect = 'disconnect',
  UpdateName = 'update-name',
  Typing = 'typing'
}
