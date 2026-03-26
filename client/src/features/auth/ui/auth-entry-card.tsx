import { KeyRound, LockKeyhole, MailCheck, MessageCircle } from 'lucide-react'
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
      await login({
        email: loginForm.email.trim(),
        password: loginForm.password
      })
      if (pendingVerificationEmail) {
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

  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-400/20 text-primary">
            {authMode === 'register' && <MessageCircle className="h-5 w-5" />}
            {authMode === 'login' && <LockKeyhole className="h-5 w-5" />}
            {authMode === 'verify' && <MailCheck className="h-5 w-5" />}
            {(authMode === 'forgot' || authMode === 'reset') && <KeyRound className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {authMode === 'register' && '注册账号'}
              {authMode === 'login' && '登录账号'}
              {authMode === 'verify' && '验证邮箱'}
              {authMode === 'forgot' && '找回密码'}
              {authMode === 'reset' && '设置新密码'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {authMode === 'verify'
                ? `验证码已发送到 ${pendingVerificationEmail ?? ''}`
                : authMode === 'forgot'
                  ? '输入注册邮箱，我们将发送重置链接。'
                  : authMode === 'reset'
                    ? '请输入你的新密码。'
                    : '聊天前必须先完成注册和邮箱验证。'}
            </p>
          </div>
        </div>

        {(authMode === 'register' || authMode === 'login') && (
          <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/50 p-1">
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                authMode === 'register' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
              onClick={() => switchAuthMode('register')}
            >
              注册
            </button>
            <button
              type="button"
              className={cn(
                'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                authMode === 'login' ? 'bg-background shadow-sm' : 'text-muted-foreground'
              )}
              onClick={() => switchAuthMode('login')}
            >
              登录
            </button>
          </div>
        )}

        {authMode === 'forgot' && (
          <button type="button" className="text-sm text-primary hover:underline" onClick={() => switchAuthMode('login')}>
            &larr; 返回登录
          </button>
        )}

        {authMode === 'reset' && (
          <button
            type="button"
            className="text-sm text-primary hover:underline"
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
            className="text-sm text-primary hover:underline"
            onClick={() => {
              setPendingVerificationEmail(null)
              switchAuthMode('register')
            }}
          >
            &larr; 返回注册
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
                className={cn(
                  'h-11 rounded-xl',
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
                  'h-11 rounded-xl',
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
              注册
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
                className={cn(
                  'h-11 rounded-xl',
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
              className="h-11 rounded-xl"
            />
            <Button onClick={handleLogin} disabled={submitting} className="h-11 w-full rounded-xl">
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
          <div className="space-y-3">
            <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
              请输入邮箱中收到的 6 位数字验证码，验证码 15 分钟内有效。
            </div>
            <Input
              value={verifyCode_}
              onChange={(event) => {
                const val = event.target.value.replace(/\D/g, '').slice(0, 6)
                setVerifyCode_(val)
              }}
              placeholder="请输入 6 位验证码"
              className="h-11 rounded-xl text-center text-lg tracking-[0.5em]"
              maxLength={6}
              inputMode="numeric"
              autoComplete="one-time-code"
            />
            <Button
              onClick={handleVerifyCode}
              disabled={submitting || verifyCode_.length !== 6}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500"
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
          <div className="space-y-3">
            <div>
              <Input
                value={forgotEmail}
                onChange={(event) => setForgotEmail(event.target.value)}
                onBlur={() => markTouched('forgot-email')}
                placeholder="注册时使用的邮箱地址"
                className={cn(
                  'h-11 rounded-xl',
                  touched['forgot-email'] && validateEmail(forgotEmail) && 'border-destructive focus-visible:ring-destructive'
                )}
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
                onChange={(event) => setResetForm((current) => ({ ...current, password: event.target.value }))}
                onBlur={() => markTouched('reset-password')}
                placeholder="新密码（至少 8 位）"
                className={cn(
                  'h-11 rounded-xl',
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
                  'h-11 rounded-xl',
                  touched['reset-confirm'] &&
                    resetForm.password !== resetForm.confirm &&
                    'border-destructive focus-visible:ring-destructive'
                )}
              />
              {touched['reset-confirm'] && resetForm.password !== resetForm.confirm && (
                <p className="mt-1 text-xs text-destructive">两次密码不一致</p>
              )}
            </div>
            <Button
              onClick={handleResetPassword}
              disabled={submitting}
              className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500"
            >
              重置密码
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
