import { PayloadType, User, UserState } from '@/shared/types'

export type ServerEnvelope = {
  type: PayloadType
  payload: unknown
}

export const getSocketUrl = (endpoint: string, sessionId: string) => {
  const url = new URL(endpoint)
  url.searchParams.set('sessionId', sessionId)
  return url.toString()
}

export const toUser = (user: Partial<User> | undefined): User | undefined => {
  if (!user?.id || !user?.name || !user?.state) {
    return undefined
  }

  return {
    id: user.id,
    name: user.name,
    state: user.state as UserState,
    isTyping: user.isTyping ?? false
  }
}
