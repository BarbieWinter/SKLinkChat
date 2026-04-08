import { API_BASE_URL } from '@/shared/config/runtime'
import { resolveAuthHeaders } from '@/shared/lib/auth-headers'
import type { Gender } from '@/shared/types'

const REQUEST_TIMEOUT_MS = 8000

export type AuthSessionPayload = {
  authenticated: boolean
  email_verified: boolean
  display_name: string | null
  short_id: string | null
  interests: string[]
  gender: Gender
  is_admin: boolean
  chat_access_restricted: boolean
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const authHeaders = await resolveAuthHeaders(init?.headers)
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders
      },
      ...init,
      signal: controller.signal
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
    } | null

    const error = new Error(payload?.message ?? `Request failed: ${response.status}`) as Error & {
      code?: string
      status?: number
    }
    error.code = payload?.code
    error.status = response.status
    throw error
  }

  return (await response.json()) as T
}

export const getAuthSession = () => requestJson<AuthSessionPayload>('/api/auth/session', { method: 'GET' })

export const logoutAccount = () =>
  requestJson<{ status: string }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({})
  })

export const updateAccountSettings = (payload: { interests: string[]; gender: Gender }) =>
  requestJson<{ display_name: string; interests: string[]; gender: Gender }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })
