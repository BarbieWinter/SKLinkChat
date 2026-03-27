import { Clock3, KeyRound, LockKeyhole, MailCheck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateUsername } from 'unique-username-generator'

import { requestPasswordReset, resetPassword } from '@/features/auth/api/auth-client'
import { useAuth } from '@/features/auth/auth-provider'
import { TurnstileField } from '@/features/auth/turnstile-field'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { useToast } from '@/shared/ui/use-toast'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const parseInterestInput = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

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

const getInitialAuthMode = (): 'register' | 'login' | 'forgot' | 'reset' | 'verify' => {
  if (typeof window === 'undefined') {
    return 'register'
  }

  const params = new URLSearchParams(window.location.search)
  return params.has('reset_token') ? 'reset' : 'register'
}

export const AuthEntryCard = () => {
  const { t } = useI18n()
  const { toast } = useToast()
  const { login, register, verifyCode, resendCode, pendingVerificationEmail, setPendingVerificationEmail } = useAuth()

  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot' | 'reset' | 'verify'>(
    () => (pendingVerificationEmail ? 'verify' : getInitialAuthMode())
  )
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
  const [verifyCode_, setVerifyCode_] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }))
  const switchAuthMode = (nextMode: typeof authMode) => {
    setTouched({})
    setAuthMode(nextMode)
  }

  const startResendCooldown = useCallback(() => {
    setResendCooldown(60)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (cooldownRef.current) clearInterval(cooldownRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (cooldownRef.current) clearInterval(cooldownRef.current)
    }
  }, [])

  const handleRegister = async () => {
    const emailError = validateEmail(registerForm.email)
    const passwordError = validatePassword(registerForm.password)
    if (emailError || passwordError) {
      setTouched((current) => ({ ...current, 'reg-email': true, 'reg-password': true }))
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
      startResendCooldown()
      setVerifyCode_('')
      switchAuthMode('verify')
      toast({
        title: '验证码已发送',
        description: '请查收邮箱中的 6 位验证码。'
      })
    } catch (error) {
      const code = (error as Error & { code?: string }).code
      if (code === 'EMAIL_ALREADY_EXISTS') {
        toast({
          title: '该邮箱已注册',
          description: '请切换到登录页面直接登录。'
        })
        setLoginForm((current) => ({ ...current, email: registerForm.email.trim() }))
        switchAuthMode('login')
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
      setTouched((current) => ({ ...current, 'login-email': true }))
      return
    }

    setSubmitting(true)
    try {
      const result = await login({
        email: loginForm.email.trim(),
        password: loginForm.password
      })
      if (result === 'verification_required') {
        startResendCooldown()
        setVerifyCode_('')
        switchAuthMode('verify')
        toast({
          title: '验证码已发送',
          description: '该账号尚未验证邮箱，验证码已发送。'
        })
      }
    } catch (error) {
      const code = (error as Error & { code?: string }).code
      toast({
        title: t('common.error'),
        description:
          code === 'INVALID_CREDENTIALS' ? '邮箱或密码错误' : error instanceof Error ? error.message : '登录失败。',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  const handleVerifyCode = async () => {
    if (!pendingVerificationEmail || verifyCode_.length !== 6) return

    setSubmitting(true)
    try {
      await verifyCode(pendingVerificationEmail, verifyCode_)
      toast({ title: '验证成功', description: '邮箱验证完成，欢迎使用。' })
    } catch (error) {
      const code = (error as Error & { code?: string }).code
      let description = error instanceof Error ? error.message : '验证失败。'
      if (code === 'VERIFICATION_MAX_ATTEMPTS') {
        description = '错误次数过多，请重新获取验证码。'
      } else if (code === 'NO_PENDING_VERIFICATION') {
        description = '验证码已失效，请重新获取。'
      }
      toast({ title: t('common.error'), description, variant: 'destructive' })
    } finally {
      setSubmitting(false)
    }
  }

  const handleResendCode = async () => {
    if (!pendingVerificationEmail || resendCooldown > 0) return

    try {
      await resendCode(pendingVerificationEmail)
      startResendCooldown()
      setVerifyCode_('')
      toast({ title: '已发送', description: '新的验证码已发送。' })
    } catch (error) {
      toast({
        title: t('common.error'),
        description: error instanceof Error ? error.message : '发送失败。',
        variant: 'destructive'
      })
    }
  }

  const handleForgotPassword = async () => {
    if (validateEmail(forgotEmail)) {
      setTouched((current) => ({ ...current, 'forgot-email': true }))
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
    const passwordError = validatePassword(resetForm.password)
    if (passwordError) {
      setTouched((current) => ({ ...current, 'reset-password': true }))
      return
    }

    if (resetForm.password !== resetForm.confirm) {
      setTouched((current) => ({ ...current, 'reset-confirm': true }))
      return
    }

    const params = new URLSearchParams(window.location.search)
    const token = params.get('reset_token')
    if (!token) {
      return
    }

    setSubmitting(true)
    try {
      await resetPassword(token, resetForm.password)
      toast({
        title: '密码已重置',
        description: '请使用新密码登录。'
      })
      switchAuthMode('login')
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

  const authTitle =
    authMode === 'register'
      ? '注册账号'
      : authMode === 'login'
        ? '登录账号'
        : authMode === 'verify'
          ? '验证邮箱'
          : authMode === 'forgot'
            ? '找回密码'
            : '设置新密码'

  const authSubtitle =
    authMode === 'verify'
      ? `验证码已发送到 ${pendingVerificationEmail ?? ''}`
      : authMode === 'forgot'
        ? '输入注册邮箱，我们将发送重置链接。'
        : authMode === 'reset'
          ? '请输入你的新密码。'
          : '完成注册与邮箱验证后，即可进入安全的匿名聊天。'

  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden px-4 py-8 sm:px-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl animate-float" />
        <div className="absolute right-[-3rem] top-1/4 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl animate-pulse" />
        <div className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-primary/15 blur-3xl animate-float [animation-delay:1.2s]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.58))] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_34%),linear-gradient(135deg,rgba(9,14,26,0.92),rgba(7,11,20,0.7))]" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px)] bg-[size:32px_32px] opacity-40" />
      </div>

      <div className="relative grid w-full max-w-5xl gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="hidden min-h-[640px] flex-col justify-between rounded-[32px] border border-sky-200/50 bg-slate-950 px-8 py-8 text-slate-50 shadow-2xl shadow-slate-950/25 lg:flex">
          <div className="space-y-6">
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-100">
              <Sparkles className="h-3.5 w-3.5" />
              Secure onboarding
            </div>

            <div className="space-y-3">
              <h2 className="max-w-md text-3xl font-semibold tracking-tight text-white xl:text-[2.6rem]">
                更安全地进入实时匿名聊天
              </h2>
              <p className="max-w-md text-sm leading-7 text-slate-300 xl:text-[15px]">
                注册、验证、登录和密码找回都在同一入口完成，验证码链路经过限流与归属校验，减少误用与刷取风险。
              </p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  icon: ShieldCheck,
                  title: '验证码链路加固',
                  description: '验证码尝试次数受控，异常或越权 token 会被立即作废。'
                },
                {
                  icon: Clock3,
                  title: '发送频率受限',
                  description: '注册后的补发、登录触发发送都会经过冷却与小时级限制。'
                },
                {
                  icon: MailCheck,
                  title: '邮箱验证闭环',
                  description: '完成邮箱验证后再进入聊天，减少匿名滥用与错误注册。'
                }
              ].map(({ icon: Icon, title, description }, index) => (
                <div
                  key={title}
                  className="animate-slide-up rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
                  style={{ animationDelay: `${index * 120}ms` }}
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-sky-400/18 text-sky-100">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">{title}</p>
                      <p className="mt-1 text-sm leading-6 text-slate-300">{description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-slate-100">
            {[
              { value: '6 位', label: '邮箱验证码' },
              { value: '15 分钟', label: '有效时长' },
              { value: '5 次', label: '错误上限' }
            ].map((item, index) => (
              <div
                key={item.label}
                className="animate-slide-up rounded-2xl border border-white/10 bg-white/10 p-4 text-center backdrop-blur-sm"
                style={{ animationDelay: `${index * 150}ms` }}
              >
                <p className="text-xl font-semibold tracking-tight text-white">{item.value}</p>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="animate-slide-up rounded-[28px] border border-border/60 bg-background/[0.82] p-5 shadow-2xl shadow-slate-900/10 backdrop-blur-xl sm:p-7">
          <div className="mb-5 rounded-[24px] border border-sky-200/50 bg-sky-50/80 p-4 text-slate-900 dark:border-sky-900/50 dark:bg-sky-950/25 dark:text-slate-100 lg:hidden">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.22em] text-sky-700 dark:text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              Secure onboarding
            </div>
            <p className="mt-3 text-lg font-semibold tracking-tight">完成验证后即可进入聊天</p>
            <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">
              当前入口整合注册、登录、邮箱验证与找回密码，移动端与桌面端都保持一致体验。
            </p>
          </div>

          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 via-sky-400/20 to-cyan-300/25 text-primary shadow-inner shadow-white/40">
              {authMode === 'register' && <MessageCircle className="h-5 w-5" />}
              {authMode === 'login' && <LockKeyhole className="h-5 w-5" />}
              {authMode === 'verify' && <MailCheck className="h-5 w-5" />}
              {(authMode === 'forgot' || authMode === 'reset') && <KeyRound className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[2rem]">{authTitle}</h1>
              <p className="mt-1 text-sm leading-6 text-muted-foreground sm:text-[15px]">{authSubtitle}</p>
            </div>
          </div>

          {(authMode === 'register' || authMode === 'login') && (
            <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl border border-border/60 bg-muted/50 p-1.5">
              <button
                type="button"
                className={cn(
                  'rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-all',
                  authMode === 'register'
                    ? 'bg-background text-foreground shadow-sm shadow-slate-900/5'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => switchAuthMode('register')}
              >
                注册
              </button>
              <button
                type="button"
                className={cn(
                  'rounded-2xl px-3 py-2.5 text-[15px] font-medium transition-all',
                  authMode === 'login'
                    ? 'bg-background text-foreground shadow-sm shadow-slate-900/5'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => switchAuthMode('login')}
              >
                登录
              </button>
            </div>
          )}

          {authMode === 'forgot' && (
            <button type="button" className="mt-5 text-sm text-primary hover:underline" onClick={() => switchAuthMode('login')}>
              &larr; 返回登录
            </button>
          )}

          {authMode === 'reset' && (
            <button
              type="button"
              className="mt-5 text-sm text-primary hover:underline"
              onClick={() => {
                switchAuthMode('login')
                window.history.replaceState({}, '', '/')
              }}
            >
              &larr; 返回登录
            </button>
          )}

          {authMode === 'verify' && (
            <button
              type="button"
              className="mt-5 text-sm text-primary hover:underline"
              onClick={() => {
                setPendingVerificationEmail(null)
                switchAuthMode('register')
              }}
            >
              &larr; 返回注册
            </button>
          )}

          {authMode === 'register' && (
            <div className="mt-5 space-y-3">
              <div>
                <Input
                  value={registerForm.email}
                  onChange={(event) => setRegisterForm((current) => ({ ...current, email: event.target.value }))}
                  onBlur={() => markTouched('reg-email')}
                  placeholder="邮箱地址"
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['reg-email'] && validateEmail(registerForm.email) && 'border-destructive focus-visible:ring-destructive'
                  )}
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
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['reg-password'] &&
                      validatePassword(registerForm.password) &&
                      'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {touched['reg-password'] && validatePassword(registerForm.password) && (
                  <p className="mt-1 text-xs text-destructive">{validatePassword(registerForm.password)}</p>
                )}
              </div>
              <Input
                value={registerForm.displayName}
                onChange={(event) => setRegisterForm((current) => ({ ...current, displayName: event.target.value }))}
                placeholder="聊天展示名"
                className="h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base"
              />
              <Input
                value={registerForm.interests}
                onChange={(event) => setRegisterForm((current) => ({ ...current, interests: event.target.value }))}
                placeholder="兴趣标签（逗号分隔，可选）"
                className="h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base"
              />
              <TurnstileField onTokenChange={setTurnstileToken} />
              <div className="rounded-2xl border border-sky-200/60 bg-sky-50/75 px-4 py-3 text-sm leading-6 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/20 dark:text-sky-100">
                提交后系统会发送 6 位验证码到你的邮箱，用于完成注册校验。
              </div>
              <Button
                onClick={handleRegister}
                disabled={submitting}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-[15px] font-medium shadow-lg shadow-sky-500/20"
              >
                注册并发送验证码
              </Button>
            </div>
          )}

          {authMode === 'login' && (
            <div className="mt-5 space-y-3">
              <div>
                <Input
                  value={loginForm.email}
                  onChange={(event) => setLoginForm((current) => ({ ...current, email: event.target.value }))}
                  onBlur={() => markTouched('login-email')}
                  placeholder="邮箱地址"
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['login-email'] && validateEmail(loginForm.email) && 'border-destructive focus-visible:ring-destructive'
                  )}
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
                className="h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base"
              />
              <Button onClick={handleLogin} disabled={submitting} className="h-12 w-full rounded-2xl text-[15px] font-medium">
                登录
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className="text-sm text-muted-foreground transition-colors hover:text-primary hover:underline"
                  onClick={() => {
                    switchAuthMode('forgot')
                    setForgotEmail(loginForm.email)
                  }}
                >
                  忘记密码？
                </button>
              </div>
            </div>
          )}

          {authMode === 'verify' && (
            <div className="mt-5 space-y-3">
              <div className="rounded-2xl border border-border/60 bg-muted/40 p-4 text-sm leading-6 text-muted-foreground">
                请输入邮箱中收到的 6 位数字验证码，验证码 15 分钟内有效，错误尝试过多后需要重新获取。
              </div>
              <Input
                value={verifyCode_}
                onChange={(event) => {
                  const val = event.target.value.replace(/\D/g, '').slice(0, 6)
                  setVerifyCode_(val)
                }}
                placeholder="请输入 6 位验证码"
                className="h-14 rounded-2xl border-border/70 bg-background/70 text-center text-2xl tracking-[0.42em] sm:text-[2rem]"
                maxLength={6}
                inputMode="numeric"
                autoComplete="one-time-code"
              />
              <Button
                onClick={handleVerifyCode}
                disabled={submitting || verifyCode_.length !== 6}
                className="h-12 w-full rounded-2xl bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-[15px] font-medium shadow-lg shadow-sky-500/20"
              >
                验证
              </Button>
              <div className="text-center">
                <button
                  type="button"
                  className={cn(
                    'text-sm transition-colors',
                    resendCooldown > 0
                      ? 'cursor-not-allowed text-muted-foreground/50'
                      : 'text-muted-foreground hover:text-primary hover:underline'
                  )}
                  onClick={handleResendCode}
                  disabled={resendCooldown > 0}
                >
                  {resendCooldown > 0 ? `${resendCooldown}s 后可重新发送` : '重新发送验证码'}
                </button>
              </div>
            </div>
          )}

          {authMode === 'forgot' && (
            <div className="mt-5 space-y-3">
              <div>
                <Input
                  value={forgotEmail}
                  onChange={(event) => setForgotEmail(event.target.value)}
                  onBlur={() => markTouched('forgot-email')}
                  placeholder="注册时使用的邮箱地址"
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['forgot-email'] && validateEmail(forgotEmail) && 'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {touched['forgot-email'] && validateEmail(forgotEmail) && (
                  <p className="mt-1 text-xs text-destructive">{validateEmail(forgotEmail)}</p>
                )}
              </div>
              <Button onClick={handleForgotPassword} disabled={submitting} className="h-12 w-full rounded-2xl text-[15px] font-medium">
                发送重置链接
              </Button>
            </div>
          )}

          {authMode === 'reset' && (
            <div className="mt-5 space-y-3">
              <div>
                <Input
                  type="password"
                  value={resetForm.password}
                  onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))}
                  onBlur={() => markTouched('reset-password')}
                  placeholder="新密码（至少 8 位）"
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['reset-password'] &&
                      validatePassword(resetForm.password) &&
                      'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {touched['reset-password'] && validatePassword(resetForm.password) && (
                  <p className="mt-1 text-xs text-destructive">{validatePassword(resetForm.password)}</p>
                )}
              </div>
              <div>
                <Input
                  type="password"
                  value={resetForm.confirm}
                  onChange={(event) => setResetForm((current) => ({ ...current, confirm: event.target.value }))}
                  onBlur={() => markTouched('reset-confirm')}
                  placeholder="确认新密码"
                  className={cn(
                    'h-12 rounded-2xl border-border/70 bg-background/70 px-4 text-[15px] sm:text-base',
                    touched['reset-confirm'] &&
                      resetForm.password !== resetForm.confirm &&
                      'border-destructive focus-visible:ring-destructive'
                  )}
                />
                {touched['reset-confirm'] && resetForm.password !== resetForm.confirm && (
                  <p className="mt-1 text-xs text-destructive">两次密码不一致</p>
                )}
              </div>
              <Button onClick={handleResetPassword} disabled={submitting} className="h-12 w-full rounded-2xl text-[15px] font-medium">
                重置密码
              </Button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
