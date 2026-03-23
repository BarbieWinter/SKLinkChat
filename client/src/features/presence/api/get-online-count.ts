import { API_BASE_URL } from '@/shared/config/runtime'

type OnlineCountResponse = {
  online_count: number
}

export const getOnlineCount = async () => {
  const response = await fetch(`${API_BASE_URL}/api/users/count`)

  if (!response.ok) {
    throw new Error(`Failed to fetch users count: ${response.status}`)
  }

  const payload = (await response.json()) as OnlineCountResponse
  return payload.online_count
}
