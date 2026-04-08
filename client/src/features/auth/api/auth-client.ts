import { API_BASE_URL } from '@/shared/config/runtime'
import { resolveAuthHeaders } from '@/shared/lib/auth-headers'
import type { Gender } from '@/shared/types'

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

export type VerificationRequiredPayload = {
  status: 'verification_required'
  masked_email: string
}

export type GeeTestCaptchaPayload = {
  lot_number: string
  captcha_output: string
  pass_token: string
  gen_time: string
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const authHeaders = await resolveAuthHeaders(init?.headers)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    ...init
  })

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

export const registerAccount = (payload: {
  email: string
  password: string
  display_name: string
  interests: string[]
  captcha: GeeTestCaptchaPayload
}) =>
  requestJson<VerificationRequiredPayload>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export const loginAccount = (payload: { email: string; password: string; captcha: GeeTestCaptchaPayload }) =>
  requestJson<AuthSessionPayload | VerificationRequiredPayload>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export const logoutAccount = () =>
  requestJson<{ status: string }>('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({})
  })

export const verifyEmailCode = (email: string, code: string) =>
  requestJson<AuthSessionPayload>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code })
  })

export const resendVerificationCode = (payload: { email: string }) =>
  requestJson<{ status: string }>('/api/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export const getAccountProfile = () =>
  requestJson<{ display_name: string; interests: string[]; gender: Gender }>('/api/account/profile', {
    method: 'GET'
  })

export const updateAccountSettings = (payload: { interests: string[]; gender: Gender }) =>
  requestJson<{ display_name: string; interests: string[]; gender: Gender }>('/api/account/profile', {
    method: 'PATCH',
    body: JSON.stringify(payload)
  })

export const requestPasswordReset = (email: string) =>
  requestJson<{ status: string }>('/api/auth/request-password-reset', {
    method: 'POST',
    body: JSON.stringify({ email })
  })

export const resetPassword = (token: string, newPassword: string) =>
  requestJson<{ status: string }>('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, new_password: newPassword })
  })
