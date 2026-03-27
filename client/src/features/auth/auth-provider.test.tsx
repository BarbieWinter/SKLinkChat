import { act, renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'

import { AuthProvider, useAuth } from '@/features/auth/auth-provider'

const { getAuthSessionSpy, storeState } = vi.hoisted(() => ({
  getAuthSessionSpy: vi.fn(),
  storeState: {
    setDisplayName: vi.fn(),
    saveSettings: vi.fn(),
    resetSession: vi.fn(),
    clear: vi.fn()
  }
}))

vi.mock('@/app/store', () => ({
  useAppStore: (selector: (state: typeof storeState) => unknown) => selector(storeState)
}))

vi.mock('@/features/auth/api/auth-client', () => ({
  getAuthSession: getAuthSessionSpy,
  loginAccount: vi.fn(),
  logoutAccount: vi.fn(),
  registerAccount: vi.fn(),
  resendVerificationCode: vi.fn(),
  updateAccountProfile: vi.fn(),
  verifyEmailCode: vi.fn()
}))

vi.mock('@/features/chat/api/session-ownership', () => ({
  clearStoredSessionId: vi.fn()
}))

describe('AuthProvider', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>

  beforeEach(() => {
    getAuthSessionSpy.mockReset()
    storeState.setDisplayName.mockReset()
    storeState.saveSettings.mockReset()
    storeState.resetSession.mockReset()
    storeState.clear.mockReset()
  })

  it('falls back to the anonymous ready state when session bootstrap fails', async () => {
    getAuthSessionSpy.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    expect(result.current.status).toBe('loading')

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
    })

    expect(result.current.authSession).toEqual({
      authenticated: false,
      email_verified: false,
      display_name: null,
      short_id: null,
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    })
  })

  it('returns refreshSession to ready even when probing /api/auth/session fails', async () => {
    getAuthSessionSpy.mockResolvedValueOnce({
      authenticated: true,
      email_verified: true,
      display_name: 'Alice',
      short_id: '100001',
      interests: ['music'],
      is_admin: false,
      chat_access_restricted: false
    })
    getAuthSessionSpy.mockRejectedValueOnce(new Error('network down'))

    const { result } = renderHook(() => useAuth(), { wrapper })

    await waitFor(() => {
      expect(result.current.status).toBe('ready')
      expect(result.current.authSession.authenticated).toBe(true)
    })

    await act(async () => {
      await result.current.refreshSession()
    })

    expect(result.current.status).toBe('ready')
    expect(result.current.authSession.authenticated).toBe(true)
  })
})
