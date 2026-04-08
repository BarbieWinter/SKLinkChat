import { Gender, PayloadType, User, UserState } from '@/shared/types'

export type ServerEnvelope = {
  type: PayloadType
  payload: unknown
}

export const getSocketUrl = (endpoint: string, sessionId: string, stackAccessToken?: string | null) => {
  const url = new URL(endpoint)
  url.searchParams.set('sessionId', sessionId)
  if (stackAccessToken) {
    url.searchParams.set('stack_access_token', stackAccessToken)
  }
  return url.toString()
}

const VALID_GENDERS = new Set<string>(['male', 'female', 'unknown'])

export const toUser = (user: Partial<User> | undefined): User | undefined => {
  if (!user?.id || !user?.name || !user?.state) {
    return undefined
  }

  const raw = user as Partial<User> & { short_id?: string; gender?: string }
  const gender = raw.gender && VALID_GENDERS.has(raw.gender) ? (raw.gender as Gender) : undefined

  return {
    id: user.id,
    name: user.name,
    shortId: typeof raw.short_id === 'string' ? raw.short_id : user.shortId,
    state: user.state as UserState,
    isTyping: user.isTyping ?? false,
    gender
  }
}
