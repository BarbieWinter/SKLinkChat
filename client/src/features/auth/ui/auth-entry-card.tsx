import { KeyRound, LockKeyhole, MessageCircle } from 'lucide-react'
import { useState } from 'react'
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

const getInitialAuthMode = (): 'register' | 'login' | 'forgot' | 'reset' => {
  if (typeof window === 'undefined') {
    return 'register'
  }

  const params = new URLSearchParams(window.location.search)
  return params.has('reset_token') ? 'reset' : 'register'
}

export const AuthEntryCard = () => {
  const { t } = useI18n()
  const { toast } = useToast()
  const { login, register, verifyMessage, verifyStatus } = useAuth()

  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot' | 'reset'>(getInitialAuthMode)
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

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }))
  const switchAuthMode = (nextMode: typeof authMode) => {
    setTouched({})
    setAuthMode(nextMode)
  }

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
            {(authMode === 'forgot' || authMode === 'reset') && <KeyRound className="h-5 w-5" />}
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">
              {authMode === 'register' && '注册账号'}
              {authMode === 'login' && '登录账号'}
              {authMode === 'forgot' && '找回密码'}
              {authMode === 'reset' && '设置新密码'}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {authMode === 'forgot'
                ? '输入注册邮箱，我们将发送重置链接。'
                : authMode === 'reset'
                  ? '请输入你的新密码。'
                  : '聊天前必须先完成注册和邮箱验证。'}
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
