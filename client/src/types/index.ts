/**
 * 前端共享类型定义：统一描述聊天消息、用户信息、用户状态和协议消息类型。
 */
export interface Message {
  sender: string
  message: string
}

export interface User {
  id: string
  name: string
  state: UserState
  isTyping?: boolean
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
  Typing = 'typing'
}
