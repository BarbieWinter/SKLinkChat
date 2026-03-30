/**
 * Shared frontend scalar types for the active chat contract.
 */
export interface Message {
  sender: string
  message: string
  /** Pretext prepared handle for layout measurement (set at addMessage time) */
  _prepared?: import('@chenglou/pretext').PreparedTextWithSegments
}

export interface User {
  id: string
  name: string
  shortId?: string
  state: UserState
  isTyping?: boolean
}

export interface PresenceCountPayload {
  online_count: number
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
  Queue = 'queue',
  Match = 'match',
  Disconnect = 'disconnect',
  Typing = 'typing',
  PresenceCount = 'presence-count'
}
