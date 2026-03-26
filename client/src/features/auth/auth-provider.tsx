import { createContext, useContext, useEffect, useMemo, useState } from 'react'

import { useAppStore } from '@/app/store'
import {
  AuthSessionPayload,
  getAuthSession,
  loginAccount,
  logoutAccount,
  registerAccount,
  resendVerification,
  updateAccountProfile,
  verifyEmail
} from '@/features/auth/api/auth-client'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'

type AuthStatus = 'loading' | 'ready' | 'error'

type AuthContextValue = {
  authSession: AuthSessionPayload
  status: AuthStatus
  verifyStatus: 'idle' | 'success' | 'error'
  verifyMessage: string | null
  register: (payload: {
    email: string
    password: string
    displayName: string
    interests: string[]
    turnstileToken: string
  }) => Promise<void>
  login: (payload: { email: string; password: string }) => Promise<void>
  logout: () => Promise<void>
  resendVerificationEmail: () => Promise<void>
  syncProfile: (payload: { displayName: string; interests: string[] }) => Promise<void>
  refreshSession: () => Promise<void>
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

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const { setDisplayName, saveSettings, resetSession, clear } = useAppStore()
  const [authSession, setAuthSession] = useState<AuthSessionPayload>(EMPTY_AUTH_SESSION)
  const [status, setStatus] = useState<AuthStatus>('loading')
  const [verifyStatus, setVerifyStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null)

  const applySession = (nextSession: AuthSessionPayload) => {
    setAuthSession(nextSession)
    setDisplayName(nextSession.display_name ?? '')
    saveSettings(nextSession.interests ?? [])
  }

  const clearVerificationFeedback = () => {
    setVerifyStatus('idle')
    setVerifyMessage(null)
  }

  const setVerificationFeedback = (status: 'success' | 'error', message: string) => {
    setVerifyStatus(status)
    setVerifyMessage(message)
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
      const params = new URLSearchParams(window.location.search)
      const verifyToken = params.get('verify_token')

      if (verifyToken) {
        try {
          const sessionAfterVerification = await verifyEmail(verifyToken)
          if (!cancelled) {
            applySession(sessionAfterVerification)
            setVerificationFeedback('success', '邮箱验证成功。')
          }
        } catch (error) {
          if (!cancelled) {
            setVerificationFeedback('error', error instanceof Error ? error.message : '邮箱验证失败。')
          }
        } finally {
          params.delete('verify_token')
          const nextQuery = params.toString()
          window.history.replaceState({}, '', nextQuery ? `/?${nextQuery}` : '/')
        }
      }

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
      verifyStatus,
      verifyMessage,
      register: async ({ email, password, displayName, interests, turnstileToken }) => {
        clearVerificationFeedback()
        const nextSession = await registerAccount({
          email,
          password,
          display_name: displayName,
          interests,
          turnstile_token: turnstileToken
        })
        applySession(nextSession)
        setStatus('ready')
        setVerificationFeedback('success', '验证邮件已发送，请先完成邮箱验证。')
      },
      login: async ({ email, password }) => {
        clearVerificationFeedback()
        const nextSession = await loginAccount({ email, password })
        applySession(nextSession)
        setStatus('ready')
      },
      logout: async () => {
        clearVerificationFeedback()
        await logoutAccount()
        clearStoredSessionId()
        clear()
        resetSession()
        applySession(EMPTY_AUTH_SESSION)
      },
      resendVerificationEmail: async () => {
        const nextSession = await resendVerification()
        applySession(nextSession)
        setVerificationFeedback(
          'success',
          nextSession.email_verified ? '当前邮箱已验证，无需重新发送。' : '新的验证邮件已发送。'
        )
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
      refreshSession
    }),
    [authSession, clear, resetSession, saveSettings, setDisplayName, status, verifyMessage, verifyStatus]
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
