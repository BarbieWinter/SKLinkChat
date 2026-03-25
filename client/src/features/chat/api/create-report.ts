import { API_BASE_URL } from '@/shared/config/runtime'

export type CreateChatReportPayload = {
  session_id: string
  reported_session_id: string
  reason: 'harassment' | 'sexual_content' | 'spam' | 'hate_speech' | 'other'
  details?: string
}

export const createChatReport = async (payload: CreateChatReportPayload) => {
  const response = await fetch(`${API_BASE_URL}/api/chat/reports`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorPayload = (await response.json().catch(() => null)) as
      | {
          code?: string
          message?: string
        }
      | null

    const error = new Error(errorPayload?.message ?? `Request failed: ${response.status}`) as Error & {
      code?: string
      status?: number
    }
    error.code = errorPayload?.code
    error.status = response.status
    throw error
  }

  return (await response.json()) as { status: string; report_id: number }
}
