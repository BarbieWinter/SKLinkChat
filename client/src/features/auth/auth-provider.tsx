import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

import { useAppStore } from '@/app/store'
import { AuthSessionPayload, getAuthSession, logoutAccount, updateAccountSettings } from '@/features/auth/api/auth-client'
import { stackClientApp } from '@/features/auth/stack-client'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'
import type { Gender } from '@/shared/types'

type AuthStatus = 'loading' | 'ready'

type AuthContextValue = {
  authSession: AuthSessionPayload
  status: AuthStatus
  logout: () => Promise<void>
  syncProfile: (payload: { interests: string[]; gender: Gender }) => Promise<void>
  refreshSession: () => Promise<void>
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

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const setDisplayName = useAppStore((state) => state.setDisplayName)
  const saveSettings = useAppStore((state) => state.saveSettings)
  const resetSession = useAppStore((state) => state.resetSession)
  const clear = useAppStore((state) => state.clear)
  const [authSession, setAuthSession] = useState<AuthSessionPayload>(EMPTY_AUTH_SESSION)
  const [status, setStatus] = useState<AuthStatus>('loading')

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
      logout: async () => {
        await logoutAccount()
        if (stackClientApp) {
          await stackClientApp.signOut().catch(() => undefined)
        }
        clearStoredSessionId()
        clear()
        resetSession()
        applySession(EMPTY_AUTH_SESSION)
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
      refreshSession
    }),
    [applySession, authSession, clear, refreshSession, resetSession, saveSettings, setDisplayName, status]
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
