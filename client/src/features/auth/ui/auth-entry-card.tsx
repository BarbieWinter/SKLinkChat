import { AnimatePresence, motion } from 'framer-motion'
import { KeyRound, LockKeyhole, MailCheck, MessageCircle, ShieldCheck, Sparkles } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { generateUsername } from 'unique-username-generator'

import { type GeeTestCaptchaPayload, requestPasswordReset, resetPassword } from '@/features/auth/api/auth-client'
import { useAuth } from '@/features/auth/auth-provider'
import { GeeTestField, type GeeTestFieldHandle } from '@/features/auth/geetest-field'
import { GEETEST_LOGIN_CAPTCHA_ID, GEETEST_REGISTER_CAPTCHA_ID } from '@/shared/config/runtime'
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

const authInputClassName =
  'h-14 rounded-2xl border border-slate-800/90 bg-slate-950/80 px-5 text-[16px] leading-6 text-slate-50 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-[15px] placeholder:text-slate-400/65 transition-all duration-200 focus-visible:border-sky-400/55 focus-visible:bg-slate-950/92 focus-visible:ring-2 focus-visible:ring-sky-400/12 focus-visible:ring-offset-0'

export const AuthEntryCard = () => {
  const { t } = useI18n()
  const { toast } = useToast()
  const { login, register, verifyCode, resendCode, pendingVerificationEmail, setPendingVerificationEmail } = useAuth()

  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot' | 'reset' | 'verify'>(() =>
    pendingVerificationEmail ? 'verify' : getInitialAuthMode()
  )
  const [captchaPayload, setCaptchaPayload] = useState<GeeTestCaptchaPayload | null>(null)
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
  const geetestRef = useRef<GeeTestFieldHandle | null>(null)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [captchaError, setCaptchaError] = useState<string | null>(null)
  const activeCaptchaId = authMode === 'login' ? GEETEST_LOGIN_CAPTCHA_ID : GEETEST_REGISTER_CAPTCHA_ID

  const markTouched = (field: string) => setTouched((current) => ({ ...current, [field]: true }))
  const switchAuthMode = (nextMode: typeof authMode) => {
    setTouched({})
    setCaptchaPayload(null)
    setCaptchaError(null)
    setAuthMode(nextMode)
  }

  const resetCaptcha = useCallback(() => {
    setCaptchaPayload(null)
    geetestRef.current?.reset()
  }, [])

  const requireCaptchaPayload = () => {
    if (captchaPayload) return true
    const description = captchaError ?? '请先完成人机校验。'
    toast({
      title: t('common.error'),
      description,
      variant: 'destructive'
    })
    return false
  }

  const handleCaptchaFailure = (code?: string, fallback = '人机校验失败，请重试。') => {
    let description = fallback
    if (code === 'GEETEST_VALIDATION_FAILED') {
      description = '人机校验未通过，请重新完成验证。'
    } else if (code === 'GEETEST_UNAVAILABLE') {
      description = '人机校验服务暂时不可用，请稍后重试。'
    } else if (code === 'GEETEST_NOT_CONFIGURED') {
      description = '极验配置缺失，当前无法提交。'
    } else if (code === 'GEETEST_FIELDS_REQUIRED') {
      description = '请先完成人机校验。'
    }
    setCaptchaError(description)

    toast({
      title: t('common.error'),
      description,
      variant: 'destructive'
    })
    resetCaptcha()
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

    if (!requireCaptchaPayload()) {
      return
    }

    setSubmitting(true)
    try {
      await register({
        email: registerForm.email.trim(),
        password: registerForm.password,
        displayName: registerForm.displayName.trim(),
        interests: parseInterestInput(registerForm.interests),
        captcha: captchaPayload as GeeTestCaptchaPayload
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
      if (code?.startsWith('GEETEST_')) {
        handleCaptchaFailure(code)
        return
      }
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
      resetCaptcha()
      setSubmitting(false)
    }
  }

  const handleLogin = async () => {
    if (validateEmail(loginForm.email)) {
      setTouched((current) => ({ ...current, 'login-email': true }))
      return
    }

    if (!requireCaptchaPayload()) {
      return
    }

    setSubmitting(true)
    try {
      const result = await login({
        email: loginForm.email.trim(),
        password: loginForm.password,
        captcha: captchaPayload as GeeTestCaptchaPayload
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
      if (code?.startsWith('GEETEST_')) {
        handleCaptchaFailure(code)
        return
      }
      toast({
        title: t('common.error'),
        description:
          code === 'INVALID_CREDENTIALS' ? '邮箱或密码错误' : error instanceof Error ? error.message : '登录失败。',
        variant: 'destructive'
      })
    } finally {
      resetCaptcha()
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
      await resendCode({ email: pendingVerificationEmail })
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
      ? '请输入邮箱中收到的 6 位验证码'
      : authMode === 'forgot'
        ? '输入注册邮箱，我们将发送重置链接。'
        : authMode === 'reset'
          ? '请输入你的新密码。'
          : authMode === 'login'
            ? '登录即可开始聊天'
            : '完成注册与邮箱验证后即可开始聊天。'

  return (
    <div className="relative flex h-full min-h-0 items-start justify-center overflow-x-hidden overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      {/* Dynamic Background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            x: [0, 50, -20, 0],
            y: [0, -30, 40, 0],
            scale: [1, 1.1, 0.9, 1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
          className="absolute -left-16 top-8 h-44 w-44 rounded-full bg-sky-400/20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, -40, 30, 0],
            y: [0, 50, -20, 0],
            scale: [1, 1.2, 0.8, 1]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: 'linear' }}
          className="absolute right-[-3rem] top-1/4 h-56 w-56 rounded-full bg-cyan-300/20 blur-3xl"
        />
        <motion.div
          animate={{
            x: [0, 30, -50, 0],
            y: [0, 40, -30, 0],
            scale: [1, 0.9, 1.1, 1]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: 'linear', delay: 2 }}
          className="absolute bottom-0 left-1/3 h-52 w-52 rounded-full bg-primary/15 blur-3xl"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.12),transparent_32%),linear-gradient(135deg,rgba(255,255,255,0.88),rgba(255,255,255,0.58))] dark:bg-[radial-gradient(circle_at_top,rgba(14,165,233,0.14),transparent_34%),linear-gradient(135deg,rgba(9,14,26,0.92),rgba(7,11,20,0.7))]" />

        {/* Animated Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ duration: 2 }}
          className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.09)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.09)_1px,transparent_1px)] bg-[size:32px_32px]"
        />
      </div>

      <div className="relative grid w-full max-w-5xl gap-5 lg:grid-cols-[1.08fr_0.92fr]">
        {/* Info Section */}
        <motion.section
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="hidden self-start rounded-[32px] border border-sky-200/50 bg-slate-950 px-8 py-8 text-slate-50 shadow-2xl shadow-slate-950/25 lg:flex lg:min-h-[640px] lg:flex-col lg:gap-8"
        >
          <div className="space-y-6">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.24em] text-sky-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Secure onboarding
            </motion.div>

            <div className="space-y-3">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="max-w-md text-3xl font-semibold tracking-tight text-white xl:text-[2.6rem]"
            >
                SKLinkChat
              </motion.h2>
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="max-w-md text-sm leading-7 text-slate-300 xl:text-[15px]"
              >
                一个让你轻松匿名开口的随机聊天空间，适合想找人倾诉、结识陌生人，或只是随手聊一会儿的时刻。
              </motion.p>
            </div>

            <div className="grid gap-3">
              {[
                {
                  icon: MessageCircle,
                  title: '匿名开聊',
                  description: '不需要公开真实身份，进入页面后就能轻量开始一段对话。'
                },
                {
                  icon: Sparkles,
                  title: '即时连接',
                  description: '完成登录后即可开始匹配，把等待和复杂步骤压到最低。'
                },
                {
                  icon: ShieldCheck,
                  title: '隐私优先',
                  description: '把表达留给当下，把压力留在门外，让聊天回到轻松本身。'
                }
              ].map(({ icon: Icon, title, description }, index) => (
                <motion.div
                  key={title}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.45 + index * 0.06, duration: 0.35, ease: 'easeOut' }}
                  whileHover={{
                    scale: 1.02,
                    backgroundColor: 'rgba(255, 255, 255, 0.15)',
                    transition: { duration: 0.12, ease: 'easeOut' }
                  }}
                  className="rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
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
                </motion.div>
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.66, duration: 0.3, ease: 'easeOut' }}
              className="rounded-[26px] border border-white/10 bg-white/6 p-5 backdrop-blur-sm"
            >
              <p className="text-[12px] font-medium uppercase tracking-[0.18em] text-slate-300">适合这些时刻</p>
              <div className="mt-4 flex flex-wrap gap-2.5">
                {['想找人倾诉', '随机认识新朋友', '深夜想聊一会', '碎片时间随手开聊'].map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-white/10 bg-white/8 px-3.5 py-2 text-[13px] text-slate-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          </div>

	        </motion.section>

        {/* Form Section */}
        <motion.section
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="relative flex flex-col rounded-[28px] border border-slate-800/70 bg-slate-950/70 p-5 text-slate-50 shadow-2xl shadow-slate-950/30 backdrop-blur-xl sm:p-7 lg:max-h-[calc(100dvh-4rem)] lg:overflow-y-auto"
        >
          {/* Mobile Info Banner */}
          <div className="mb-7 rounded-[24px] border border-slate-800/80 bg-slate-900/85 p-4 text-slate-100 lg:hidden">
            <div className="flex items-center gap-2 text-[12px] font-medium uppercase tracking-[0.12em] text-sky-300">
              <Sparkles className="h-3.5 w-3.5" />
              Secure onboarding
            </div>
            <p className="mt-3 text-[22px] font-semibold leading-[1.25] tracking-[0.01em]">SKLinkChat</p>
            <p className="mt-2 text-[14px] leading-[1.65] text-slate-300">
              匿名、安全、即时的陌生人聊天平台，守护每个用户的隐私。
            </p>
          </div>

          <div className="flex items-start gap-3">
            <motion.div
              key={authMode}
              initial={{ scale: 0.8, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400/16 via-cyan-300/12 to-slate-800 text-sky-200 shadow-inner shadow-white/5"
            >
              {authMode === 'register' && <MessageCircle className="h-5 w-5" />}
              {authMode === 'login' && <LockKeyhole className="h-5 w-5" />}
              {authMode === 'verify' && <MailCheck className="h-5 w-5" />}
              {(authMode === 'forgot' || authMode === 'reset') && <KeyRound className="h-5 w-5" />}
            </motion.div>
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={authTitle}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.2 }}
                >
                  <h1 className="text-[20px] font-semibold leading-[1.25] tracking-[0.01em] text-slate-50 sm:text-[22px]">
                    {authTitle}
                  </h1>
                  <p className="mt-1.5 text-[14px] leading-[1.65] text-slate-300">{authSubtitle}</p>
                  {authMode === 'verify' && pendingVerificationEmail && (
                    <p className="mt-1 text-[14px] leading-6 text-slate-400">{pendingVerificationEmail}</p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {(authMode === 'register' || authMode === 'login') && (
            <div className="relative mt-6 grid grid-cols-2 gap-2 rounded-2xl border border-slate-800/80 bg-slate-900/75 p-1.5">
              <div
                className="absolute inset-y-1.5 left-1.5 right-1.5 w-[calc(50%-1.5px)] pointer-events-none transition-transform duration-300 ease-out"
                style={{ transform: `translateX(${authMode === 'login' ? '100%' : '0'})` }}
              >
                <div className="h-full w-full rounded-2xl bg-slate-800 shadow-sm shadow-black/20" />
              </div>
              <button
                type="button"
                className={cn(
                  'relative z-10 h-11 rounded-2xl px-3 text-[15px] font-medium transition-colors',
                  authMode === 'register' ? 'text-slate-50' : 'text-slate-400 hover:text-slate-50'
                )}
                onClick={() => switchAuthMode('register')}
              >
                注册
              </button>
              <button
                type="button"
                className={cn(
                  'relative z-10 h-11 rounded-2xl px-3 text-[15px] font-medium transition-colors',
                  authMode === 'login' ? 'text-slate-50' : 'text-slate-400 hover:text-slate-50'
                )}
                onClick={() => switchAuthMode('login')}
              >
                登录
              </button>
            </div>
          )}

          <div className="flex-1">
            <AnimatePresence mode="wait">
              <motion.div
                key={authMode}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                className="mt-5 space-y-3"
              >
                {captchaError && (authMode === 'register' || authMode === 'login') && (
                  <p className="text-[13px] leading-6 text-destructive">{captchaError}</p>
                )}

                {authMode === 'forgot' && (
                  <button
                    type="button"
                    className="text-[14px] text-primary hover:underline"
                    onClick={() => switchAuthMode('login')}
                  >
                    &larr; 返回登录
                  </button>
                )}

                {authMode === 'reset' && (
                  <button
                    type="button"
                    className="text-[14px] text-primary hover:underline"
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
                    className="text-[14px] text-primary hover:underline"
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
                          authInputClassName,
                          touched['reg-email'] &&
                            validateEmail(registerForm.email) &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
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
                        onChange={(event) =>
                          setRegisterForm((current) => ({ ...current, password: event.target.value }))
                        }
                        onBlur={() => markTouched('reg-password')}
                        placeholder="密码（至少 8 位）"
                        className={cn(
                          authInputClassName,
                          touched['reg-password'] &&
                            validatePassword(registerForm.password) &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
                        )}
                      />
                      {touched['reg-password'] && validatePassword(registerForm.password) && (
                        <p className="mt-1 text-xs text-destructive">{validatePassword(registerForm.password)}</p>
                      )}
                    </div>
                    <Input
                      value={registerForm.displayName}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, displayName: event.target.value }))
                      }
                      placeholder="聊天展示名"
                      className={authInputClassName}
                    />
                    <Input
                      value={registerForm.interests}
                      onChange={(event) =>
                        setRegisterForm((current) => ({ ...current, interests: event.target.value }))
                      }
                      placeholder="兴趣标签（逗号分隔，可选）"
                      className={authInputClassName}
                    />
                    <GeeTestField
                      ref={geetestRef}
                      captchaId={activeCaptchaId}
                      onValidateChange={(payload) => {
                        setCaptchaError(null)
                        setCaptchaPayload(payload)
                      }}
                      onError={setCaptchaError}
                    />
                    {captchaError && <p className="text-[13px] leading-6 text-destructive">{captchaError}</p>}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleRegister}
                        disabled={submitting}
                        className="h-14 w-full rounded-2xl bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-[16px] font-semibold shadow-md shadow-sky-500/10 transition-all hover:shadow-sky-500/15 active:opacity-90"
                      >
                        注册并发送验证码
                      </Button>
                    </motion.div>
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
                          authInputClassName,
                          touched['login-email'] &&
                            validateEmail(loginForm.email) &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
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
                      className={authInputClassName}
                    />
                    <GeeTestField
                      ref={geetestRef}
                      captchaId={activeCaptchaId}
                      onValidateChange={(payload) => {
                        setCaptchaError(null)
                        setCaptchaPayload(payload)
                      }}
                      onError={setCaptchaError}
                    />
                    {captchaError && <p className="text-[13px] leading-6 text-destructive">{captchaError}</p>}
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleLogin}
                        disabled={submitting}
                        className="h-14 w-full rounded-2xl text-[16px] font-semibold shadow-sm transition-all"
                      >
                        登录
                      </Button>
                    </motion.div>
                    <div className="text-center">
                      <button
                        type="button"
                        className="text-[14px] text-muted-foreground transition-colors hover:text-primary hover:underline"
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
                    <div className="rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4 text-[14px] leading-[1.65] text-slate-300">
                      请输入邮箱中收到的 6 位验证码
                      <br />
                      验证码 15 分钟内有效，错误过多需重新获取
                    </div>
                    <motion.div
                      initial={{ scale: 0.95, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                    >
                      <Input
                        value={verifyCode_}
                        onChange={(event) => {
                          const val = event.target.value.replace(/\D/g, '').slice(0, 6)
                          setVerifyCode_(val)
                        }}
                        placeholder="请输入 6 位验证码"
                        className={cn(
                          authInputClassName,
                          'text-center tracking-[0.02em] placeholder:tracking-[0.02em]'
                        )}
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                      />
                    </motion.div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleVerifyCode}
                        disabled={submitting || verifyCode_.length !== 6}
                        className="h-14 w-full rounded-2xl bg-gradient-to-r from-primary via-sky-500 to-cyan-500 text-[16px] font-semibold shadow-md shadow-sky-500/10 transition-all"
                      >
                        验证
                      </Button>
                    </motion.div>
                    <div className="text-center">
                      <button
                        type="button"
                        className={cn(
                          'text-[13px] transition-colors',
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
                          authInputClassName,
                          touched['forgot-email'] &&
                            validateEmail(forgotEmail) &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
                        )}
                      />
                      {touched['forgot-email'] && validateEmail(forgotEmail) && (
                        <p className="mt-1 text-xs text-destructive">{validateEmail(forgotEmail)}</p>
                      )}
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleForgotPassword}
                        disabled={submitting}
                        className="h-14 w-full rounded-2xl text-[16px] font-semibold shadow-sm transition-all"
                      >
                        发送重置链接
                      </Button>
                    </motion.div>
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
                          authInputClassName,
                          touched['reset-password'] &&
                            validatePassword(resetForm.password) &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
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
                          authInputClassName,
                          touched['reset-confirm'] &&
                            resetForm.password !== resetForm.confirm &&
                            'border-destructive/80 focus-visible:border-destructive focus-visible:ring-destructive/15'
                        )}
                      />
                      {touched['reset-confirm'] && resetForm.password !== resetForm.confirm && (
                        <p className="mt-1 text-xs text-destructive">两次密码不一致</p>
                      )}
                    </div>
                    <motion.div whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.98 }}>
                      <Button
                        onClick={handleResetPassword}
                        disabled={submitting}
                        className="h-14 w-full rounded-2xl text-[16px] font-semibold shadow-sm transition-all"
                      >
                        重置密码
                      </Button>
                    </motion.div>
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.section>
      </div>
    </div>
  )
}
