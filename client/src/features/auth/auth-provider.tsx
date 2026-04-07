import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { useAppStore } from '@/app/store'
import {
  AuthSessionPayload,
  GeeTestCaptchaPayload,
  VerificationRequiredPayload,
  getAuthSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerificationCode,
  updateAccountSettings,
  verifyEmailCode
} from '@/features/auth/api/auth-client'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'
import type { Gender } from '@/shared/types'

type AuthStatus = 'loading' | 'ready'
type LoginResult = 'authenticated' | 'verification_required'

type AuthContextValue = {
  authSession: AuthSessionPayload
  status: AuthStatus
  pendingVerificationEmail: string | null
  register: (payload: {
    email: string
    password: string
    displayName: string
    interests: string[]
    captcha: GeeTestCaptchaPayload
  }) => Promise<void>
  login: (payload: { email: string; password: string; captcha: GeeTestCaptchaPayload }) => Promise<LoginResult>
  logout: () => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  resendCode: (payload: { email: string }) => Promise<void>
  syncProfile: (payload: { interests: string[]; gender: Gender }) => Promise<void>
  refreshSession: () => Promise<void>
  setPendingVerificationEmail: (email: string | null) => void
}

const EMPTY_AUTH_SESSION: AuthSessionPayload = {
  authenticated: false,
  email_verified: false,
  display_name: null,
  short_id: null,
  interests: [],
  gender: 'unknown',
  is_admin: false,
  chat_access_restricted: false
}

const isVerificationRequired = (
  result: AuthSessionPayload | VerificationRequiredPayload
): result is VerificationRequiredPayload => 'status' in result && result.status === 'verification_required'

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const setDisplayName = useAppStore((state) => state.setDisplayName)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const resetSession = useAppStore((state) => state.resetSession)
  const clear = useAppStore((state) => state.clear)
  const [authSession, setAuthSession] = useState<AuthSessionPayload>(EMPTY_AUTH_SESSION)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  const applySession = useCallback(
    (nextSession: AuthSessionPayload) => {
      setAuthSession(nextSession)
      setDisplayName(nextSession.display_name ?? '')
      saveSettings(nextSession.interests ?? [])
    },
    [saveSettings, setDisplayName]
  )

  const refreshSession = useCallback(async () => {
    try {
      const nextSession = await getAuthSession()
      applySession(nextSession)
    } catch {
      // Session probing must always settle so the entry page can render for anonymous users.
    }
  }, [applySession])

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const nextSession = await getAuthSession()
        if (!cancelled) {
          applySession(nextSession)
        }
      } catch {
        // Leave the default anonymous session in place when bootstrap fails.
      } finally {
        if (!cancelled) {
          setStatus('ready')
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [applySession])

  const value = useMemo<AuthContextValue>(
    () => ({
      authSession,
      status,
      pendingVerificationEmail,
      register: async ({ email, password, displayName, interests, captcha }) => {
        await registerAccount({
          email,
          password,
          display_name: displayName,
          interests,
          captcha
        })
        setPendingVerificationEmail(email)
      },
      login: async ({ email, password, captcha }) => {
        const result = await loginAccount({ email, password, captcha })
        if (isVerificationRequired(result)) {
          setPendingVerificationEmail(email)
          return 'verification_required'
        }
        applySession(result)
        setStatus('ready')
        return 'authenticated'
      },
      logout: async () => {
        await logoutAccount()
        clearStoredSessionId()
        clear()
        resetSession()
        applySession(EMPTY_AUTH_SESSION)
        setPendingVerificationEmail(null)
      },
      verifyCode: async (email: string, code: string) => {
        const nextSession = await verifyEmailCode(email, code)
        applySession(nextSession)
        setPendingVerificationEmail(null)
        setStatus('ready')
      },
      resendCode: async ({ email }) => {
        await resendVerificationCode({ email })
      },
      syncProfile: async ({ interests, gender }) => {
        const nextProfile = await updateAccountSettings({ interests, gender })
        setDisplayName(nextProfile.display_name)
        saveSettings(nextProfile.interests)
        setAuthSession((currentSession) => ({
          ...currentSession,
          display_name: nextProfile.display_name,
          interests: nextProfile.interests,
          gender: nextProfile.gender
        }))
      },
      refreshSession,
      setPendingVerificationEmail
    }),
    [authSession, clear, pendingVerificationEmail, resetSession, saveSettings, setDisplayName, status]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
