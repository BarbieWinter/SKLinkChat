import { API_BASE_URL } from '@/shared/config/runtime'
import { resolveAuthHeaders } from '@/shared/lib/auth-headers'

import { PresenceCountPayload } from '@/shared/types'

export const ONLINE_USER_COUNT_QUERY_KEY = ['onlineUserCount'] as const

export const getOnlineCount = async () => {
  const headers = await resolveAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/api/users/count`, { headers })

  if (!response.ok) {
    throw new Error(`Failed to fetch users count: ${response.status}`)
  }

  const payload = (await response.json()) as PresenceCountPayload
  return payload.online_count
}
