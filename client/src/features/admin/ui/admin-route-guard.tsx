import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'

export const AdminRouteGuard = () => {
  const location = useLocation()
  const { authSession, status, refreshSession } = useAuth()
  const [validatedEntryKey, setValidatedEntryKey] = useState<string | null>(null)
  const [isRevalidating, setIsRevalidating] = useState(false)
  const mountedRef = useRef(true)

  const currentEntryKey = useMemo(
    () => `${location.pathname}:${authSession.authenticated ? 'authenticated' : 'anonymous'}`,
    [authSession.authenticated, location.pathname]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (status !== 'ready') {
      return
    }

    if (!authSession.authenticated) {
      setValidatedEntryKey(currentEntryKey)
      setIsRevalidating(false)
      return
    }

    if (validatedEntryKey === currentEntryKey || isRevalidating) {
      return
    }

    setIsRevalidating(true)

    void refreshSession().finally(() => {
      if (mountedRef.current) {
        setValidatedEntryKey(currentEntryKey)
        setIsRevalidating(false)
      }
    })
  }, [authSession.authenticated, currentEntryKey, isRevalidating, refreshSession, status, validatedEntryKey])

  if (status === 'loading' || isRevalidating) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/90 p-6 text-center shadow-xl shadow-black/5 dark:shadow-black/20">
          <p className="text-sm text-muted-foreground">正在加载管理端权限...</p>
        </div>
      </div>
    )
  }

  if (!authSession.authenticated) {
    return <Navigate to="/" replace />
  }

  if (!authSession.is_admin) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div
          data-testid="admin-forbidden"
          className="w-full max-w-lg rounded-3xl border border-border/50 bg-card/90 p-8 text-center shadow-2xl shadow-black/10"
        >
          <h1 className="text-xl font-semibold text-foreground">当前账号没有管理权限</h1>
          <p className="mt-3 text-sm text-muted-foreground">如果这不是预期行为，请检查当前账号在数据库中的管理员状态。</p>
        </div>
      </div>
    )
  }

  return <Outlet />
}
