import { useEffect, useMemo, useState } from 'react'
import { AuthPage, useUser } from '@stackframe/react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'
import { stackAuthEnabled, stackClientApp } from '@/features/auth/stack-client'

const SESSION_SYNC_MAX_ATTEMPTS = 5
const SESSION_SYNC_INTERVAL_MS = 500

const wait = (ms: number) => new Promise((resolve) => window.setTimeout(resolve, ms))

const StackNotConfiguredNotice = () => (
  <div className="flex min-h-screen items-center justify-center px-6">
    <div className="w-full max-w-lg border border-border bg-card p-6 text-card-foreground">
      <p className="text-sm leading-6">
        Stack Auth 尚未配置。请先在前端环境变量中设置 `VITE_STACK_PROJECT_ID` 与 `VITE_STACK_PUBLISHABLE_CLIENT_KEY`。
      </p>
      <p className="mt-4 text-sm text-muted-foreground">
        配置完成后访问 <code>/auth/stack</code> 进行登录注册验证。
      </p>
      <Link to="/" className="mt-5 inline-block text-sm text-primary underline underline-offset-4">
        返回首页
      </Link>
    </div>
  </div>
)

const StackAuthEnabledPage = ({ mode }: { mode: 'sign-up' | 'sign-in' }) => {
  const user = useUser()
  const { authSession, status, refreshSession } = useAuth()
  const [syncingSession, setSyncingSession] = useState(false)
  const [syncFailed, setSyncFailed] = useState(false)
  const [syncRound, setSyncRound] = useState(0)
  const stackUserId = user?.id ?? null

  useEffect(() => {
    if (!stackUserId || authSession.authenticated || status !== 'ready') {
      setSyncingSession(false)
      setSyncFailed(false)
      return
    }

    let cancelled = false
    setSyncingSession(true)
    setSyncFailed(false)

    const syncSession = async () => {
      for (let attempt = 0; attempt < SESSION_SYNC_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) return
        await refreshSession()
        if (cancelled) return
        await wait(SESSION_SYNC_INTERVAL_MS)
      }
      if (!cancelled) {
        setSyncingSession(false)
        setSyncFailed(true)
      }
    }

    void syncSession()

    return () => {
      cancelled = true
    }
  }, [authSession.authenticated, refreshSession, stackUserId, status, syncRound])

  const retrySync = () => {
    setSyncRound((value) => value + 1)
  }

  const signOutStackSession = async () => {
    if (!stackClientApp) return
    setSyncingSession(true)
    setSyncFailed(false)
    await stackClientApp.signOut().catch(() => undefined)
    await refreshSession().catch(() => undefined)
    setSyncingSession(false)
  }

  const syncMessage = useMemo(() => {
    if (syncingSession) {
      return '正在同步登录状态...'
    }
    if (syncFailed) {
      return '已检测到 Stack 登录态，但本地会话同步失败。请重试同步或退出后重新登录。'
    }
    return ''
  }, [syncFailed, syncingSession])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <p className="text-sm text-muted-foreground">正在同步登录状态...</p>
      </div>
    )
  }

  if (authSession.authenticated) {
    return <Navigate to="/chat" replace />
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg border border-border bg-card p-6 text-card-foreground">
          <p className="text-sm leading-6 text-muted-foreground">{syncMessage}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            {syncFailed ? (
              <button
                type="button"
                className="rounded border border-border px-4 py-2 text-sm hover:bg-accent/20"
                onClick={retrySync}
              >
                重试同步
              </button>
            ) : null}
            {syncFailed ? (
              <button
                type="button"
                className="rounded border border-border px-4 py-2 text-sm hover:bg-accent/20"
                onClick={signOutStackSession}
              >
                退出并重新登录
              </button>
            ) : null}
          </div>
        </div>
      </div>
    )
  }

  return <AuthPage type={mode} firstTab="magic-link" fullPage />
}

const StackAuthPage = () => {
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'signup' ? 'sign-up' : 'sign-in'

  if (!stackAuthEnabled) {
    return <StackNotConfiguredNotice />
  }

  return <StackAuthEnabledPage mode={mode} />
}

export default StackAuthPage
