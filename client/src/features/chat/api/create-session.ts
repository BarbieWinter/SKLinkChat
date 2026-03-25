import { API_BASE_URL } from '@/shared/config/runtime'

export type SessionResponse = {
  session_id: string
}

export const createSession = async (): Promise<SessionResponse> => {
  const response = await fetch(`${API_BASE_URL}/api/session`, {
    method: 'POST',
    credentials: 'include'
  })

  if (!response.ok) {
    throw new Error(`Failed to create session: ${response.status}`)
  }

  return (await response.json()) as SessionResponse
}
