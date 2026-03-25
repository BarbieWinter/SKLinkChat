import { Contact, KeyRound, LockKeyhole, LogOut, MailCheck, MessageCircle, PanelLeftClose, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { generateUsername } from 'unique-username-generator'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { requestPasswordReset, resetPassword } from '@/features/auth/api/auth-client'
import { TurnstileField } from '@/features/auth/turnstile-field'
import { useChat } from '@/features/chat/chat-provider'
import ChatReportDialog from '@/features/chat/ui/chat-report-dialog'
import ChatPanel from '@/features/chat/ui/chat-panel'
import SettingsDialog from '@/features/settings/ui/settings-dialog'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useToast } from '@/shared/ui/use-toast'


const parseInterestInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)


const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const validateEmail = (value: string): string | null => {
  const trimmed = value.trim()
  if (!trimmed) return '请输入邮箱地址'
  if (!EMAIL_RE.test(trimmed)) return '邮箱格式不正确'
  return null
}

const validatePassword = (value: string): string | null => {
  if (!value) return '请输入密码'
  if (value.length < 8) return '密码至少 8 位'
  return null
}


const HomePage = () => {
  const { t, formatUserState } = useI18n()
  const { toast } = useToast()
  const { keywords } = useAppStore()
  const { authSession, status, verifyMessage, verifyStatus, login, logout, register, resendVerificationEmail } =
    useAuth()
  const { stranger, me, sessionId } = useChat()

  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isCompactViewport, setCompactViewport] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const previousState = useRef<UserState | undefined>(me?.state)

  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot' | 'reset'>(() => {
    const params = new URLSearchParams(window.location.search)
    return params.has('reset_token') ? 'reset' : 'register'
  })
  const [turnstileToken, setTurnstileToken] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [resetForm, setResetForm] = useState({ password: '', confirm: '' })
  const [registerForm, setRegisterForm] = useState({
    email: '',
    password: '',
    displayName: generateUsername(),
    interests: ''
  })
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: ''
  })
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const markTouched = (field: string) => setTouched((prev) => ({ ...prev, [field]: true }))

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncViewport = () => {
      const compact = window.innerWidth < 1280
      setCompactViewport(compact)
      if (compact) {
        setSidebarCollapsed(true)
      }
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (me?.state === UserState.Connected && previousState.current !== UserState.Connected) {
      setSidebarCollapsed(true)
      setMobileSheetOpen(false)
    }

    if (previousState.current === UserState.Connected && me?.state !== UserState.Connected && !isCompactViewport) {
      setSidebarCollapsed(false)
    }

    previousState.current = me?.state
  }, [isCompactViewport, me?.state])

  const handleRegister = async () => {
    const emailError = validateEmail(registerForm.email)
    const passwordError = validatePassword(registerForm.password)
    if (emailError || passwordError) {
      setTouched((prev) => ({ ...prev, 'reg-email': true, 'reg-password': true }))
      return
    }

    if (!turnstileToken) {
      toast({
        title: t('common.error'),
        description: 'Turnstile 校验尚未完成。',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    try {
      await register({
        email: registerForm.email.trim(),
        password: registerForm.password,
        displayName: registerForm.displayName.trim(),
        interests: parseInterestInput(registerForm.interests),
        turnstileToken
      })
      toast({
        title: '注册成功',
        description: '验证邮件已发送，请先完成邮箱验证。'
      })
    } catch (error) {
      const code = (error as Error & { code?: string }).code
      if (code === 'EMAIL_ALREADY_EXISTS') {
        toast({
          title: '该邮箱已注册',
          description: '请切换到登录页面直接登录。'
        })
        setLoginForm((prev) => ({ ...prev, email: registerForm.email.trim() }))
        setAuthMode('login')
        setTouched({})
      } else {
        toast({
          title: t('common.error'),
          description: error instanceof Error ? error.message : '注册失败。',
          variant: 'destructive'
        })
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogin = async () => {
    if (validateEmail(loginForm.email)) {
      setTouched((prev) => ({ ...prev, 'login-email': true }))
      return
    }

    setSubmitting(true)
    try {
      await login({
        email: loginForm.email.trim(),
        password: loginForm.password
      })
    } catch (error) {
      const code = (error as Error & { code?: string }).code
      toast({
        title: t('common.error'),
        description: code === 'INVALID_CREDENTIALS' ? '邮箱或密码错误' : error instanceof Error ? error.message : '登录失败。',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleForgotPassword = async () => {
    if (validateEmail(forgotEmail)) {
      setTouched((prev) => ({ ...prev, 'forgot-email': true }))
      return
    }
    setSubmitting(true)
    try {
      await requestPasswordReset(forgotEmail.trim())
      toast({
        title: '邮件已发送',
        description: '如该邮箱已注册，重置密码链接已发送到你的邮箱。'
      })
    } catch {
      toast({
        title: '邮件已发送',
        description: '如该邮箱已注册，重置密码链接已发送到你的邮箱。'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResetPassword = async () => {
    const pwError = validatePassword(resetForm.password)
    if (pwError) {
      setTouched((prev) => ({ ...prev, 'reset-password': true }))
      return
    }
    if (resetForm.password !== resetForm.confirm) {
      setTouched((prev) => ({ ...prev, 'reset-confirm': true }))
      return
    }
    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset_token')
    if (!token) return

    setSubmitting(true)
    try {
      await resetPassword(token, resetForm.password)
      toast({
        title: '密码已重置',
        description: '请使用新密码登录。'
      })
      setAuthMode('login')
      setTouched({})
      window.history.replaceState({}, '', '/')
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : '重置密码失败。',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/90 p-6 text-center shadow-xl shadow-black/5 dark:shadow-black/20">
          <p className="text-sm text-muted-foreground">正在加载账户状态...</p>
        </div>
      </div>
    )
  }

  if (!authSession.authenticated) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-400/20 text-primary">
              {authMode === 'register' && <MessageCircle className="h-5 w-5" />}
              {authMode === 'login' && <LockKeyhole className="h-5 w-5" />}
              {authMode === 'forgot' && <KeyRound className="h-5 w-5" />}
              {authMode === 'reset' && <KeyRound className="h-5 w-5" />}
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">
                {authMode === 'register' && '注册账号'}
                {authMode === 'login' && '登录账号'}
                {authMode === 'forgot' && '找回密码'}
                {authMode === 'reset' && '设置新密码'}
              </h1>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {authMode === 'forgot' ? '输入注册邮箱，我们将发送重置链接。' : authMode === 'reset' ? '请输入你的新密码。' : '聊天前必须先完成注册和邮箱验证。'}
              </p>
            </div>
          </div>

          {verifyMessage && (
            <div
              className={cn(
                'rounded-xl px-3 py-2 text-sm',
                verifyStatus === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {verifyMessage}
            </div>
          )}

          {(authMode === 'register' || authMode === 'login') && (
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  authMode === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
                onClick={() => { setAuthMode('register'); setTouched({}) }}
              >
                注册
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  authMode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                )}
                onClick={() => { setAuthMode('login'); setTouched({}) }}
              >
                登录
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setAuthMode('login'); setTouched({}) }}>
              &larr; 返回登录
            </button>
          )}

          {authMode === 'reset' && (
            <button type="button" className="text-sm text-primary hover:underline" onClick={() => { setAuthMode('login'); setTouched({}); window.history.replaceState({}, '', '/') }}>
              &larr; 返回登录
            </button>
          )}

          {authMode === 'register' && (
            <div className="space-y-3">
              <div>
                <Input
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                  onBlur={() => markTouched('reg-email')}
                  placeholder="邮箱地址"
                  className={cn('h-11 rounded-xl', touched['reg-email'] && validateEmail(registerForm.email) && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['reg-email'] && validateEmail(registerForm.email) && (
                  <p className="mt-1 text-xs text-destructive">{validateEmail(registerForm.email)}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  value={registerForm.password}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, password: event.target.value }))}
                  onBlur={() => markTouched('reg-password')}
                  placeholder="密码（至少 8 位）"
                  className={cn('h-11 rounded-xl', touched['reg-password'] && validatePassword(registerForm.password) && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['reg-password'] && validatePassword(registerForm.password) && (
                  <p className="mt-1 text-xs text-destructive">{validatePassword(registerForm.password)}</p>
                )}
              </div>
              <Input
                value={registerForm.displayName}
                onChange={(event) => setRegisterForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="聊天展示名"
                className="h-11 rounded-xl"
              />
              <Input
                value={registerForm.interests}
                onChange={(event) => setRegisterForm((current) => ({ ...current, interests: event.target.value }))}
                placeholder="兴趣标签（逗号分隔，可选）"
                className="h-11 rounded-xl"
              />
              <TurnstileField onTokenChange={setTurnstileToken} />
              <Button
                onClick={handleRegister}
                disabled={submitting}
                className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500"
              >
                注册并登录
              </Button>
            </div>
          )}

          {authMode === 'login' && (
            <div className="space-y-3">
              <div>
                <Input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  onBlur={() => markTouched('login-email')}
                  placeholder="邮箱地址"
                  className={cn('h-11 rounded-xl', touched['login-email'] && validateEmail(loginForm.email) && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['login-email'] && validateEmail(loginForm.email) && (
                  <p className="mt-1 text-xs text-destructive">{validateEmail(loginForm.email)}</p>
                )}
              </div>
              <Input
                type="password"
                value={loginForm.password}
                onChange={(event) => setLoginForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="密码"
                className="h-11 rounded-xl"
              />
              <Button onClick={handleLogin} disabled={submitting} className="h-11 w-full rounded-xl">
                登录
              </Button>
              <div className="text-center">
                <button type="button" className="text-sm text-muted-foreground hover:text-primary hover:underline transition-colors" onClick={() => { setAuthMode('forgot'); setTouched({}); setForgotEmail(loginForm.email) }}>
                  忘记密码？
                </button>
              </div>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="space-y-3">
              <div>
                <Input
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  onBlur={() => markTouched('forgot-email')}
                  placeholder="注册时使用的邮箱地址"
                  className={cn('h-11 rounded-xl', touched['forgot-email'] && validateEmail(forgotEmail) && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['forgot-email'] && validateEmail(forgotEmail) && (
                  <p className="mt-1 text-xs text-destructive">{validateEmail(forgotEmail)}</p>
                )}
              </div>
              <Button onClick={handleForgotPassword} disabled={submitting} className="h-11 w-full rounded-xl">
                发送重置链接
              </Button>
            </div>
          )}

          {authMode === 'reset' && (
            <div className="space-y-3">
              <div>
                <Input
                  type="password"
                  value={resetForm.password}
                  onChange={(event) => setResetForm((prev) => ({ ...prev, password: event.target.value }))}
                  onBlur={() => markTouched('reset-password')}
                  placeholder="新密码（至少 8 位）"
                  className={cn('h-11 rounded-xl', touched['reset-password'] && validatePassword(resetForm.password) && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['reset-password'] && validatePassword(resetForm.password) && (
                  <p className="mt-1 text-xs text-destructive">{validatePassword(resetForm.password)}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  value={resetForm.confirm}
                  onChange={(event) => setResetForm((prev) => ({ ...prev, confirm: event.target.value }))}
                  onBlur={() => markTouched('reset-confirm')}
                  placeholder="确认新密码"
                  className={cn('h-11 rounded-xl', touched['reset-confirm'] && resetForm.password !== resetForm.confirm && 'border-destructive focus-visible:ring-destructive')}
                />
                {touched['reset-confirm'] && resetForm.password !== resetForm.confirm && (
                  <p className="mt-1 text-xs text-destructive">两次密码不一致</p>
                )}
              </div>
              <Button onClick={handleResetPassword} disabled={submitting} className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500">
                重置密码
              </Button>
            </div>
          )}
        </div>
      </div>
    )
  }

  if (!authSession.email_verified) {
    return (
      <div className="flex h-full items-center justify-center px-4 py-8">
        <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-400/20 text-amber-600">
              <MailCheck className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">等待邮箱验证</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">验证完成前，无法进入匹配和聊天。</p>
            </div>
          </div>

          {verifyMessage && (
            <div
              className={cn(
                'rounded-xl px-3 py-2 text-sm',
                verifyStatus === 'success'
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                  : 'bg-destructive/10 text-destructive'
              )}
            >
              {verifyMessage}
            </div>
          )}

          <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
            当前账号已登录，但还没有通过邮箱验证。你可以重新发送验证邮件，验证完成后刷新页面即可进入聊天。
          </div>

          <div className="flex gap-3">
            <Button
              className="flex-1 rounded-xl"
              onClick={async () => {
                try {
                  await resendVerificationEmail()
                  toast({ title: '已发送', description: '新的验证邮件已发送。' })
                } catch (error) {
                  toast({
                    title: t('common.error'),
                    description: error instanceof Error ? error.message : '发送失败。',
                    variant: 'destructive'
                  })
                }
              }}
            >
              重新发送验证邮件
            </Button>
            <Button
              variant="outline"
              className="group rounded-xl transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:scale-95"
              onClick={async () => {
                await logout()
              }}
            >
              <LogOut className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
              退出登录
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <div className="space-y-4 p-3">
      <div className="flex justify-end">
        {!isCompactViewport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
        {isCompactViewport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setMobileSheetOpen(false)}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <div className="rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Contact className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('home.profile')}</h3>
          </div>
          <Badge className="rounded-full text-[10px]">{formatUserState(me?.state)}</Badge>
        </div>
        <p className="mt-3 text-base font-semibold">{me?.name ?? authSession.display_name ?? '-'}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {keywords.length > 0 ? (
            keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="rounded-full text-[11px]">
                {keyword}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">{t('home.interestsEmpty')}</span>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <SettingsDialog />
          <button
            type="button"
            className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-95"
            onClick={async () => {
              await logout()
            }}
          >
            <LogOut className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>退出登录</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('home.currentPartner')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {me?.state === UserState.Connected && stranger?.id && (
              <ChatReportDialog
                sessionId={sessionId}
                reportedSessionId={stranger.id}
                partnerName={stranger.name}
                triggerClassName="h-7 rounded-full border border-destructive/20 bg-destructive/5 px-2.5 py-0 text-[11px] hover:bg-destructive/10"
              />
            )}
            <Badge variant="outline" className="rounded-full text-[10px]">
              {formatUserState(stranger?.state)}
            </Badge>
          </div>
        </div>
        {stranger ? (
          <div className="animate-fade-in mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold text-white">
              {stranger.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-base font-semibold">{stranger.name}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-medium">{t('home.noPartner')}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t('home.noPartnerDescription')}</p>
          </div>
        )}
      </div>
    </div>
  )

  if (isCompactViewport) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ChatPanel onOpenSidebar={() => setMobileSheetOpen(true)} showSidebarToggle />
        </div>

        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
            mobileSheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setMobileSheetOpen(false)}
        />

        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
            mobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="mx-2 mb-2 max-h-[75vh] overflow-y-auto scroll-touch rounded-2xl bg-card/95 glass ring-1 ring-border/30 safe-area-bottom">
            <div className="sticky top-0 z-10 flex justify-center bg-card/80 glass pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            {sidebarContent}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-0">
      {!isSidebarCollapsed && (
        <div className="animate-fade-in w-[300px] shrink-0 overflow-y-auto border-r border-border/40">
          {sidebarContent}
        </div>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <ChatPanel onOpenSidebar={() => setSidebarCollapsed(false)} showSidebarToggle={isSidebarCollapsed} />
      </div>
    </div>
  )
}

export default HomePage
