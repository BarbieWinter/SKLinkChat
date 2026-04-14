import { API_BASE_URL } from '@/shared/config/runtime'
import { resolveAuthHeaders } from '@/shared/lib/auth-headers'

import { PresenceCountPayload } from '@/shared/types'

export const ONLINE_USER_COUNT_QUERY_KEY = ['onlineUserCount'] as const

/**
 * 记录 WebSocket 最近一次推送在线人数的时间戳。
 * OnlineUserCount 组件用它判断是否需要发起 HTTP 轮询：
 * 若 WS 在最近 REFRESH_INTERVAL 内已推送过数据，则跳过 HTTP 请求，
 * 避免过期的 HTTP 响应覆盖 WS 推送的更新值。
 */
export const wsPresenceTracker = { lastPushedAt: 0 }

export const getOnlineCount = async (signal?: AbortSignal) => {
  const headers = await resolveAuthHeaders()
  const response = await fetch(`${API_BASE_URL}/api/users/count`, { headers, signal })

  if (!response.ok) {
    throw new Error(`Failed to fetch users count: ${response.status}`)
  }

  const payload = (await response.json()) as PresenceCountPayload
  return payload.online_count
}
