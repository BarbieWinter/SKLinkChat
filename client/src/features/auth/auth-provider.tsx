import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { useAppStore } from '@/app/store'
import {
  AuthSessionPayload,
  VerificationRequiredPayload,
  getAuthSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerificationCode,
  updateAccountProfile,
  verifyEmailCode
} from '@/features/auth/api/auth-client'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'

type AuthStatus = 'loading' | 'ready' | 'error'

type AuthContextValue = {
  authSession: AuthSessionPayload
  status: AuthStatus
  pendingVerificationEmail: string | null
  register: (payload: {
    email: string
    password: string
    displayName: string
    interests: string[]
    turnstileToken: string
  }) => Promise<void>
  login: (payload: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  verifyCode: (email: string, code: string) => Promise<void>
  resendCode: (email: string) => Promise<void>
  syncProfile: (payload: { displayName: string; interests: string[] }) => Promise<void>
  refreshSession: () => Promise<void>
  setPendingVerificationEmail: (email: string | null) => void
}

const EMPTY_AUTH_SESSION: AuthSessionPayload = {
  authenticated: false,
  email_verified: false,
  display_name: null,
  short_id: null,
  interests: [],
  is_admin: false,
  chat_access_restricted: false
}

const isVerificationRequired = (
  result: AuthSessionPayload | VerificationRequiredPayload
): result is VerificationRequiredPayload => 'status' in result && result.status === 'verification_required'

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { setDisplayName, saveSettings, resetSession, clear } = useAppStore()
  const [authSession, setAuthSession] = useState<AuthSessionPayload>(EMPTY_AUTH_SESSION)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [pendingVerificationEmail, setPendingVerificationEmail] = useState<string | null>(null)

  const applySession = (nextSession: AuthSessionPayload) => {
    setAuthSession(nextSession)
    setDisplayName(nextSession.display_name ?? '')
    saveSettings(nextSession.interests ?? [])
  }

  const refreshSession = async () => {
    setStatus('loading')
    try {
      const nextSession = await getAuthSession()
      applySession(nextSession)
      setStatus('ready')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    let cancelled = false

    const bootstrap = async () => {
      try {
        const nextSession = await getAuthSession()
        if (!cancelled) {
          applySession(nextSession)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) {
          setStatus('error')
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [saveSettings, setDisplayName])

  const value = useMemo<AuthContextValue>(
    () => ({
      authSession,
      status,
      pendingVerificationEmail,
      register: async ({ email, password, displayName, interests, turnstileToken }) => {
        await registerAccount({
          email,
          password,
          display_name: displayName,
          interests,
          turnstile_token: turnstileToken
        })
        setPendingVerificationEmail(email)
      },
      login: async ({ email, password }) => {
        const result = await loginAccount({ email, password })
        if (isVerificationRequired(result)) {
          setPendingVerificationEmail(email)
          return
        }
        applySession(result)
        setStatus('ready')
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
      resendCode: async (email: string) => {
        await resendVerificationCode(email)
      },
      syncProfile: async ({ displayName, interests }) => {
        const nextProfile = await updateAccountProfile({
          display_name: displayName,
          interests
        })
        setDisplayName(nextProfile.display_name)
        saveSettings(nextProfile.interests)
        setAuthSession((currentSession) => ({
          ...currentSession,
          display_name: nextProfile.display_name,
          interests: nextProfile.interests
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
