/**
 * Auth entry card — orbit-centered redesign.
 *
 * Full-screen layout: Matrix rain canvas as background, large orbit rings
 * centered on screen, login/register form floating at the orbit center with
 * glowing text effects. GeeTest captcha integrated inline.
 */
import { AnimatePresence, motion } from 'framer-motion'
import { useCallback, useEffect, useRef, useState } from 'react'

import { type GeeTestCaptchaPayload, requestPasswordReset, resetPassword } from '@/features/auth/api/auth-client'
import { useAuth } from '@/features/auth/auth-provider'
import { GeeTestField, type GeeTestFieldHandle } from '@/features/auth/geetest-field'
import { GEETEST_LOGIN_CAPTCHA_ID, GEETEST_REGISTER_CAPTCHA_ID } from '@/shared/config/runtime'
import { useI18n } from '@/shared/i18n/use-i18n'
import { useToast } from '@/shared/ui/use-toast'

// ─── Validation helpers ───────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const parseInterestInput = (v: string) =>
  v.split(',').map((s) => s.trim()).filter(Boolean)

const validateEmail       = (v: string) => !v.trim() ? '请输入邮箱地址' : !EMAIL_RE.test(v.trim()) ? '邮箱格式不正确' : null
const validatePassword    = (v: string) => !v ? '请输入密码' : v.length < 8 ? '密码至少 8 位' : null
const validateDisplayName = (v: string) => !v.trim() ? '请输入用户名' : v.trim().length > 80 ? '用户名不能超过 80 个字符' : null

const getInitialMode = (): 'register' | 'login' | 'forgot' | 'reset' | 'verify' => {
  if (typeof window === 'undefined') return 'register'
  return new URLSearchParams(window.location.search).has('reset_token') ? 'reset' : 'register'
}

// ─── Matrix rain canvas ───────────────────────────────────────────────────────

const MATRIX_CHARS =
  'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン' +
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-*:./!?#'

function useMatrixRain(ref: React.RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const FS = 13
    let W = 0, H = 0, cols = 0
    let drops: number[] = []
    let rafId = 0
    let last = 0

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      W = canvas.offsetWidth
      H = canvas.offsetHeight
      canvas.width  = W * dpr
      canvas.height = H * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      cols  = Math.floor(W / FS)
      drops = Array.from({ length: cols }, () => Math.random() * -(H / FS))
    }

    const draw = (t: number) => {
      rafId = requestAnimationFrame(draw)
      if (t - last < 55) return   // ~18 fps
      last = t

      ctx.fillStyle = 'rgba(5,8,12,0.055)'
      ctx.fillRect(0, 0, W, H)

      ctx.font = `${FS}px 'Departure Mono', monospace`
      ctx.textAlign = 'center'

      for (let i = 0; i < cols; i++) {
        const ch = MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]!
        const x  = i * FS + FS * 0.5
        const y  = drops[i]! * FS

        ctx.fillStyle = '#a8ffbf'
        ctx.fillText(ch, x, y)

        if (y > H && Math.random() > 0.974) drops[i] = 0
        drops[i]! += 0.55
      }
    }

    resize()
    rafId = requestAnimationFrame(draw)
    window.addEventListener('resize', resize)
    return () => { cancelAnimationFrame(rafId); window.removeEventListener('resize', resize) }
  }, [ref])
}

// ─── Orbit rings (enlarged, full-screen backdrop) ─────────────────────────────

const ORBIT_SIZE = 580
const OX = ORBIT_SIZE / 2  // 290
const OY = ORBIT_SIZE / 2  // 290

function buildMarkers(r: number, count: number, size: number): [number, number][] {
  return Array.from({ length: count }, (_, i) => {
    const a = (i / count) * Math.PI * 2
    return [OX + r * Math.sin(a) - size / 2, OY - r * Math.cos(a) - size / 2]
  })
}

function OrbitRings() {
  const inner  = buildMarkers(108, 10, 4)
  const middle = buildMarkers(186, 7,  5)
  const outer  = buildMarkers(264, 5,  7)

  const TO = `${OX}px ${OY}px`

  return (
    <div style={{ position: 'relative', width: ORBIT_SIZE, height: ORBIT_SIZE, pointerEvents: 'none' }}>
      {/* Static ring borders */}
      <svg
        viewBox={`0 0 ${ORBIT_SIZE} ${ORBIT_SIZE}`}
        width={ORBIT_SIZE}
        height={ORBIT_SIZE}
        style={{ position: 'absolute', inset: 0 }}
      >
        {/* Extra outermost faint ring */}
        <circle cx={OX} cy={OY} r="285" fill="none" stroke="rgba(34,211,238,0.05)" strokeWidth="1" strokeDasharray="1 30" />
        <circle cx={OX} cy={OY} r="264" fill="none" stroke="rgba(34,211,238,0.09)" strokeWidth="1" strokeDasharray="1 22" />
        <circle cx={OX} cy={OY} r="186" fill="none" stroke="rgba(34,211,238,0.13)" strokeWidth="1" strokeDasharray="2 16" />
        <circle cx={OX} cy={OY} r="108" fill="none" stroke="rgba(34,211,238,0.20)" strokeWidth="1" strokeDasharray="3 10" />
        {/* Inner glow ring */}
        <circle cx={OX} cy={OY} r="108" fill="none" stroke="rgba(34,211,238,0.06)" strokeWidth="8" />
      </svg>

      {/* Inner ring markers — CW 8s */}
      <div style={{ position: 'absolute', inset: 0, animation: 'auth-orbit-cw 8s linear infinite', transformOrigin: TO }}>
        {inner.map(([x, y], i) => (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: 4, height: 4,
            background: '#22d3ee',
            boxShadow: '0 0 6px rgba(34,211,238,0.8)',
          }} />
        ))}
      </div>

      {/* Middle ring markers — CCW 15s */}
      <div style={{ position: 'absolute', inset: 0, animation: 'auth-orbit-ccw 15s linear infinite', transformOrigin: TO }}>
        {middle.map(([x, y], i) => (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: 5, height: 5,
            borderRadius: '50%',
            background: 'rgba(134,239,172,0.75)',
            boxShadow: '0 0 5px rgba(134,239,172,0.5)',
          }} />
        ))}
      </div>

      {/* Outer ring markers — CW 28s, diamond */}
      <div style={{ position: 'absolute', inset: 0, animation: 'auth-orbit-cw 28s linear infinite', transformOrigin: TO }}>
        {outer.map(([x, y], i) => (
          <div key={i} style={{
            position: 'absolute', left: x, top: y, width: 7, height: 7,
            background: 'rgba(255,255,255,0.45)',
            boxShadow: '0 0 4px rgba(255,255,255,0.3)',
            transform: 'rotate(45deg)',
          }} />
        ))}
      </div>
    </div>
  )
}

// ─── Pixel input / button components ─────────────────────────────────────────

const PX_INPUT_BASE: React.CSSProperties = {
  fontFamily: "'Departure Mono', 'JetBrains Mono Variable', monospace",
  background: 'rgba(3,6,14,0.72)',
  border: '1px solid rgba(34,211,238,0.22)',
  borderRadius: 0,
  color: '#d4d8e0',
  padding: '0.7rem 0.9rem',
  fontSize: '0.7rem',
  letterSpacing: '0.05em',
  width: '100%',
  outline: 'none',
  transition: 'border-color 0.15s, box-shadow 0.15s',
}

const PX_INPUT_ERR: React.CSSProperties = {
  ...PX_INPUT_BASE,
  borderColor: 'rgba(239,68,68,0.6)',
}

function PixelInput({
  value, onChange, onBlur, placeholder, type = 'text',
  maxLength, inputMode, autoComplete, hasError = false,
}: {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur?: () => void
  placeholder: string
  type?: string
  maxLength?: number
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
  autoComplete?: string
  hasError?: boolean
}) {
  const [focused, setFocused] = useState(false)
  return (
    <input
      value={value}
      onChange={onChange}
      onBlur={() => { setFocused(false); onBlur?.() }}
      onFocus={() => setFocused(true)}
      placeholder={placeholder}
      type={type}
      maxLength={maxLength}
      inputMode={inputMode}
      autoComplete={autoComplete}
      style={{
        ...(hasError ? PX_INPUT_ERR : PX_INPUT_BASE),
        ...(focused ? {
          borderColor: 'rgba(34,211,238,0.6)',
          boxShadow: '0 0 0 1px rgba(34,211,238,0.15), 0 0 16px rgba(34,211,238,0.10), inset 0 0 8px rgba(34,211,238,0.04)',
        } : {}),
      }}
    />
  )
}

function PxBtn({
  onClick, disabled = false, children, variant = 'primary',
}: {
  onClick?: () => void
  disabled?: boolean
  children: React.ReactNode
  variant?: 'primary' | 'ghost'
}) {
  const [hov, setHov] = useState(false)
  const base: React.CSSProperties = {
    fontFamily: "'Departure Mono', 'JetBrains Mono Variable', monospace",
    fontSize: '0.66rem',
    letterSpacing: '0.22em',
    textTransform: 'uppercase',
    cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none',
    borderRadius: 0,
    padding: '0.82rem 1.5rem',
    width: '100%',
    transition: 'all 0.12s',
    opacity: disabled ? 0.4 : 1,
  }
  const styles: Record<string, React.CSSProperties> = {
    primary: {
      ...base,
      background: hov && !disabled ? 'rgba(34,211,238,0.18)' : 'rgba(34,211,238,0.09)',
      border: `1px solid ${hov && !disabled ? 'rgba(34,211,238,0.7)' : 'rgba(34,211,238,0.38)'}`,
      color: '#22d3ee',
      textShadow: hov && !disabled ? '0 0 12px rgba(34,211,238,0.7)' : '0 0 6px rgba(34,211,238,0.3)',
      boxShadow: hov && !disabled ? '0 0 18px rgba(34,211,238,0.12), inset 0 0 10px rgba(34,211,238,0.05)' : 'none',
    },
    ghost: {
      ...base,
      background: 'transparent',
      border: '1px solid rgba(212,216,224,0.15)',
      color: 'rgba(212,216,224,0.5)',
    },
  }
  return (
    <button
      onClick={disabled ? undefined : onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={styles[variant]}
    >
      {children}
    </button>
  )
}

const ERR: React.CSSProperties = {
  fontFamily: "'Departure Mono', monospace",
  fontSize: '0.58rem',
  color: 'rgba(239,68,68,0.85)',
  marginTop: '0.28rem',
  letterSpacing: '0.06em',
}

// ─── Main component ───────────────────────────────────────────────────────────

export const AuthEntryCard = () => {
  const { t } = useI18n()
  const { toast } = useToast()
  const { login, register, verifyCode, resendCode, pendingVerificationEmail, setPendingVerificationEmail } = useAuth()

  const [authMode, setAuthMode] = useState<'register' | 'login' | 'forgot' | 'reset' | 'verify'>(() =>
    pendingVerificationEmail ? 'verify' : getInitialMode()
  )
  const [captchaPayload, setCaptchaPayload] = useState<GeeTestCaptchaPayload | null>(null)
  const [submitting, setSubmitting]         = useState(false)
  const [captchaError, setCaptchaError]     = useState<string | null>(null)
  const [touched, setTouched]               = useState<Record<string, boolean>>({})
  const [forgotEmail, setForgotEmail]       = useState('')
  const [resetForm, setResetForm]           = useState({ password: '', confirm: '' })
  const [registerForm, setRegisterForm]     = useState({ email: '', password: '', displayName: '', interests: '' })
  const [loginForm, setLoginForm]           = useState({ email: '', password: '' })
  const [verifyCode_, setVerifyCode_]       = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)

  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const geetestRef  = useRef<GeeTestFieldHandle | null>(null)
  const matrixRef   = useRef<HTMLCanvasElement>(null)

  const activeCaptchaId = authMode === 'login' ? GEETEST_LOGIN_CAPTCHA_ID : GEETEST_REGISTER_CAPTCHA_ID

  useMatrixRain(matrixRef)
  useEffect(() => () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }, [])

  const markTouched = (f: string) => setTouched(p => ({ ...p, [f]: true }))

  const switchMode = (m: typeof authMode) => {
    setTouched({})
    setCaptchaPayload(null)
    setCaptchaError(null)
    setAuthMode(m)
  }

  const resetCaptcha = useCallback(() => {
    setCaptchaPayload(null)
    geetestRef.current?.reset()
  }, [])

  const requireCaptcha = () => {
    if (captchaPayload) return true
    toast({ title: t('common.error'), description: captchaError ?? '请先完成人机校验。', variant: 'destructive' })
    return false
  }

  const handleCaptchaFailure = (code?: string, fallback = '人机校验失败，请重试。') => {
    let desc = fallback
    if (code === 'GEETEST_VALIDATION_FAILED') desc = '人机校验未通过，请重新完成验证。'
    else if (code === 'GEETEST_UNAVAILABLE')  desc = '人机校验服务暂时不可用，请稍后重试。'
    else if (code === 'GEETEST_NOT_CONFIGURED') desc = '极验配置缺失，当前无法提交。'
    else if (code === 'GEETEST_FIELDS_REQUIRED') desc = '请先完成人机校验。'
    setCaptchaError(desc)
    toast({ title: t('common.error'), description: desc, variant: 'destructive' })
    resetCaptcha()
  }

  const startCooldown = useCallback(() => {
    setResendCooldown(60)
    if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown(p => { if (p <= 1) { if (cooldownRef.current) clearInterval(cooldownRef.current); return 0 } return p - 1 })
    }, 1000)
  }, [])

  const handleRegister = async () => {
    const eErr = validateEmail(registerForm.email)
    const pErr = validatePassword(registerForm.password)
    const nErr = validateDisplayName(registerForm.displayName)
    if (eErr || pErr || nErr) {
      setTouched(p => ({ ...p, 'reg-email': true, 'reg-password': true, 'reg-name': true }))
      return
    }
    if (!requireCaptcha()) return
    setSubmitting(true)
    try {
      await register({
        email: registerForm.email.trim(), password: registerForm.password,
        displayName: registerForm.displayName.trim(),
        interests: parseInterestInput(registerForm.interests),
        captcha: captchaPayload as GeeTestCaptchaPayload,
      })
      startCooldown(); setVerifyCode_(''); switchMode('verify')
      toast({ title: '验证码已发送', description: '请查收邮箱中的 6 位验证码。' })
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      if (code?.startsWith('GEETEST_')) { handleCaptchaFailure(code); return }
      if (code === 'EMAIL_ALREADY_EXISTS') {
        toast({ title: '该邮箱已注册', description: '请切换到登录页面直接登录。' })
        setLoginForm(p => ({ ...p, email: registerForm.email.trim() }))
        switchMode('login')
      } else if (code === 'DISPLAY_NAME_ALREADY_EXISTS') {
        toast({ title: '用户名已被占用', description: '请更换一个唯一用户名。', variant: 'destructive' })
      } else {
        toast({ title: t('common.error'), description: err instanceof Error ? err.message : '注册失败。', variant: 'destructive' })
      }
    } finally { resetCaptcha(); setSubmitting(false) }
  }

  const handleLogin = async () => {
    if (validateEmail(loginForm.email)) { setTouched(p => ({ ...p, 'login-email': true })); return }
    if (!requireCaptcha()) return
    setSubmitting(true)
    try {
      const result = await login({ email: loginForm.email.trim(), password: loginForm.password, captcha: captchaPayload as GeeTestCaptchaPayload })
      if (result === 'verification_required') {
        startCooldown(); setVerifyCode_(''); switchMode('verify')
        toast({ title: '验证码已发送', description: '该账号尚未验证邮箱，验证码已发送。' })
      }
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      if (code?.startsWith('GEETEST_')) { handleCaptchaFailure(code); return }
      toast({
        title: t('common.error'),
        description: code === 'INVALID_CREDENTIALS' ? '邮箱或密码错误' : err instanceof Error ? err.message : '登录失败。',
        variant: 'destructive',
      })
    } finally { resetCaptcha(); setSubmitting(false) }
  }

  const handleVerify = async () => {
    if (!pendingVerificationEmail || verifyCode_.length !== 6) return
    setSubmitting(true)
    try {
      await verifyCode(pendingVerificationEmail, verifyCode_)
      toast({ title: '验证成功', description: '邮箱验证完成，欢迎使用。' })
    } catch (err) {
      const code = (err as Error & { code?: string }).code
      let desc = err instanceof Error ? err.message : '验证失败。'
      if (code === 'VERIFICATION_MAX_ATTEMPTS') desc = '错误次数过多，请重新获取验证码。'
      else if (code === 'NO_PENDING_VERIFICATION') desc = '验证码已失效，请重新获取。'
      toast({ title: t('common.error'), description: desc, variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  const handleResend = async () => {
    if (!pendingVerificationEmail || resendCooldown > 0) return
    try {
      await resendCode({ email: pendingVerificationEmail })
      startCooldown(); setVerifyCode_('')
      toast({ title: '已发送', description: '新的验证码已发送。' })
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : '发送失败。', variant: 'destructive' })
    }
  }

  const handleForgot = async () => {
    if (validateEmail(forgotEmail)) { setTouched(p => ({ ...p, 'forgot-email': true })); return }
    setSubmitting(true)
    try { await requestPasswordReset(forgotEmail.trim()) } catch { /* always show success */ }
    toast({ title: '邮件已发送', description: '如该邮箱已注册，重置密码链接已发送到你的邮箱。' })
    setSubmitting(false)
  }

  const handleReset = async () => {
    if (validatePassword(resetForm.password)) { setTouched(p => ({ ...p, 'reset-password': true })); return }
    if (resetForm.password !== resetForm.confirm) { setTouched(p => ({ ...p, 'reset-confirm': true })); return }
    const token = new URLSearchParams(window.location.search).get('reset_token')
    if (!token) return
    setSubmitting(true)
    try {
      await resetPassword(token, resetForm.password)
      toast({ title: '密码已重置', description: '请使用新密码登录。' })
      switchMode('login')
      window.history.replaceState({}, '', '/')
    } catch (err) {
      toast({ title: t('common.error'), description: err instanceof Error ? err.message : '重置密码失败。', variant: 'destructive' })
    } finally { setSubmitting(false) }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const modeLabel = authMode === 'register' ? '注册账号'
    : authMode === 'login' ? '登录账号'
    : authMode === 'verify' ? '邮箱验证'
    : authMode === 'forgot' ? '找回密码'
    : '设置新密码'

  const CARD: React.CSSProperties = {
    background: 'rgba(4,7,16,0.86)',
    border: '1px solid rgba(34,211,238,0.22)',
    borderRadius: 0,
    padding: '1.75rem 1.6rem',
    width: '100%',
    maxWidth: 370,
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    display: 'flex',
    flexDirection: 'column',
    gap: '0.1rem',
    position: 'relative',
    boxShadow: '0 0 60px rgba(34,211,238,0.05), 0 0 120px rgba(34,211,238,0.03)',
  }

  const LABEL: React.CSSProperties = {
    fontFamily: "'Departure Mono', monospace",
    fontSize: '0.55rem',
    letterSpacing: '0.28em',
    textTransform: 'uppercase',
    color: 'rgba(34,211,238,0.35)',
    marginBottom: '0.5rem',
  }

  const TITLE: React.CSSProperties = {
    fontFamily: "'Departure Mono', monospace",
    fontSize: '1.05rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: '#22d3ee',
    textShadow: '0 0 24px rgba(34,211,238,0.55), 0 0 48px rgba(34,211,238,0.22)',
    marginBottom: '1.4rem',
    textAlign: 'center',
  }

  const GAP: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: '0.55rem' }

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100dvh',
      background: '#050810',
      overflow: 'hidden',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* Matrix rain canvas */}
      <canvas
        ref={matrixRef}
        style={{
          position: 'absolute', inset: 0,
          width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 0,
          opacity: 0.32,
        }}
      />

      {/* Dark vignette — darkens edges, leaves center bright */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse 75% 75% at 50% 50%, transparent 25%, rgba(5,8,16,0.82) 100%)',
        pointerEvents: 'none',
      }} />

      {/* Orbit rings — large, centered behind form */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 2,
        pointerEvents: 'none',
      }}>
        <OrbitRings />
      </div>

      {/* Center radial glow */}
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 260, height: 260,
        background: 'radial-gradient(ellipse 60% 60% at 50% 50%, rgba(34,211,238,0.07) 0%, transparent 70%)',
        borderRadius: '50%',
        zIndex: 2,
        pointerEvents: 'none',
      }} />

      {/* Form overlay — sits on top of orbits at center */}
      <div style={{
        position: 'relative',
        zIndex: 3,
        width: '100%',
        maxWidth: 420,
        padding: '0 1rem',
        overflowY: 'auto',
        maxHeight: '100dvh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={CARD}>
          {/* Corner pixel decorations */}
          <div style={{ position: 'absolute', top: -1,    left: -1,    width: 10, height: 10, borderTop: '2px solid rgba(34,211,238,0.7)', borderLeft: '2px solid rgba(34,211,238,0.7)' }} />
          <div style={{ position: 'absolute', top: -1,    right: -1,   width: 10, height: 10, borderTop: '2px solid rgba(34,211,238,0.7)', borderRight: '2px solid rgba(34,211,238,0.7)' }} />
          <div style={{ position: 'absolute', bottom: -1, left: -1,    width: 10, height: 10, borderBottom: '2px solid rgba(34,211,238,0.7)', borderLeft: '2px solid rgba(34,211,238,0.7)' }} />
          <div style={{ position: 'absolute', bottom: -1, right: -1,   width: 10, height: 10, borderBottom: '2px solid rgba(34,211,238,0.7)', borderRight: '2px solid rgba(34,211,238,0.7)' }} />

          {/* Brand label */}
          <div style={LABEL}>// SKLINKCHAT</div>

          {/* Mode title with glow */}
          <AnimatePresence mode="wait">
            <motion.div
              key={modeLabel}
              initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.2 }}
              style={TITLE}
            >
              {modeLabel}
            </motion.div>
          </AnimatePresence>

          {/* Tab bar — register / login */}
          {(authMode === 'register' || authMode === 'login') && (
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              border: '1px solid rgba(34,211,238,0.18)',
              marginBottom: '1.2rem',
            }}>
              {(['register', 'login'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => switchMode(m)}
                  style={{
                    fontFamily: "'Departure Mono', monospace",
                    fontSize: '0.6rem',
                    letterSpacing: '0.2em',
                    textTransform: 'uppercase',
                    padding: '0.62rem',
                    border: 'none',
                    borderRadius: 0,
                    cursor: 'pointer',
                    transition: 'all 0.14s',
                    background: authMode === m ? 'rgba(34,211,238,0.08)' : 'transparent',
                    color: authMode === m ? '#22d3ee' : 'rgba(212,216,224,0.32)',
                    textShadow: authMode === m ? '0 0 10px rgba(34,211,238,0.5)' : 'none',
                    borderBottom: authMode === m ? '1px solid rgba(34,211,238,0.7)' : '1px solid transparent',
                  }}
                >
                  {m === 'register' ? '注 册' : '登 录'}
                </button>
              ))}
            </div>
          )}

          {/* Back links */}
          {(authMode === 'forgot' || authMode === 'reset') && (
            <button
              onClick={() => { switchMode('login'); if (authMode === 'reset') window.history.replaceState({}, '', '/') }}
              style={{ fontFamily: "'Departure Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em',
                color: 'rgba(34,211,238,0.55)', background: 'none', border: 'none', cursor: 'pointer',
                marginBottom: '1rem', textAlign: 'left', padding: 0 }}
            >
              ← 返回登录
            </button>
          )}
          {authMode === 'verify' && (
            <button
              onClick={() => { setPendingVerificationEmail(null); switchMode('register') }}
              style={{ fontFamily: "'Departure Mono', monospace", fontSize: '0.58rem', letterSpacing: '0.1em',
                color: 'rgba(34,211,238,0.55)', background: 'none', border: 'none', cursor: 'pointer',
                marginBottom: '1rem', textAlign: 'left', padding: 0 }}
            >
              ← 返回注册
            </button>
          )}

          {/* Forms */}
          <AnimatePresence mode="wait">
            <motion.div
              key={authMode}
              initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.18 }}
              style={GAP}
            >
              {/* REGISTER */}
              {authMode === 'register' && (<>
                <div>
                  <PixelInput value={registerForm.email}
                    onChange={e => setRegisterForm(p => ({ ...p, email: e.target.value }))}
                    onBlur={() => markTouched('reg-email')}
                    placeholder="邮箱地址"
                    hasError={!!(touched['reg-email'] && validateEmail(registerForm.email))} />
                  {touched['reg-email'] && validateEmail(registerForm.email) && <p style={ERR}>{validateEmail(registerForm.email)}</p>}
                </div>
                <div>
                  <PixelInput value={registerForm.password} type="password"
                    onChange={e => setRegisterForm(p => ({ ...p, password: e.target.value }))}
                    onBlur={() => markTouched('reg-password')}
                    placeholder="密码（至少 8 位）"
                    hasError={!!(touched['reg-password'] && validatePassword(registerForm.password))} />
                  {touched['reg-password'] && validatePassword(registerForm.password) && <p style={ERR}>{validatePassword(registerForm.password)}</p>}
                </div>
                <div>
                  <PixelInput value={registerForm.displayName}
                    onChange={e => setRegisterForm(p => ({ ...p, displayName: e.target.value }))}
                    onBlur={() => markTouched('reg-name')}
                    placeholder="用户名（唯一，不可重复）"
                    hasError={!!(touched['reg-name'] && validateDisplayName(registerForm.displayName))} />
                  {touched['reg-name'] && validateDisplayName(registerForm.displayName) && <p style={ERR}>{validateDisplayName(registerForm.displayName)}</p>}
                </div>
                <PixelInput value={registerForm.interests}
                  onChange={e => setRegisterForm(p => ({ ...p, interests: e.target.value }))}
                  placeholder="兴趣标签（逗号分隔，可选）" />
                <GeeTestField ref={geetestRef} captchaId={activeCaptchaId}
                  onValidateChange={p => { setCaptchaError(null); setCaptchaPayload(p) }}
                  onError={setCaptchaError} />
                {captchaError && <p style={ERR}>{captchaError}</p>}
                <div style={{ marginTop: '0.35rem' }}>
                  <PxBtn onClick={handleRegister} disabled={submitting}>
                    {submitting ? '处理中...' : '注册并发送验证码'}
                  </PxBtn>
                </div>
              </>)}

              {/* LOGIN */}
              {authMode === 'login' && (<>
                <div>
                  <PixelInput value={loginForm.email}
                    onChange={e => setLoginForm(p => ({ ...p, email: e.target.value }))}
                    onBlur={() => markTouched('login-email')}
                    placeholder="邮箱地址"
                    hasError={!!(touched['login-email'] && validateEmail(loginForm.email))} />
                  {touched['login-email'] && validateEmail(loginForm.email) && <p style={ERR}>{validateEmail(loginForm.email)}</p>}
                </div>
                <PixelInput value={loginForm.password} type="password"
                  onChange={e => setLoginForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="密码" />
                <GeeTestField ref={geetestRef} captchaId={activeCaptchaId}
                  onValidateChange={p => { setCaptchaError(null); setCaptchaPayload(p) }}
                  onError={setCaptchaError} />
                {captchaError && <p style={ERR}>{captchaError}</p>}
                <div style={{ marginTop: '0.35rem' }}>
                  <PxBtn onClick={handleLogin} disabled={submitting}>
                    {submitting ? '处理中...' : '登 录'}
                  </PxBtn>
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
                  <button onClick={() => { switchMode('forgot'); setForgotEmail(loginForm.email) }}
                    style={{ fontFamily: "'Departure Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.1em',
                      color: 'rgba(212,216,224,0.28)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                    忘记密码？
                  </button>
                </div>
              </>)}

              {/* VERIFY */}
              {authMode === 'verify' && (<>
                <div style={{
                  fontFamily: "'Departure Mono', monospace", fontSize: '0.6rem', letterSpacing: '0.07em',
                  color: 'rgba(212,216,224,0.5)', lineHeight: 1.7,
                  border: '1px solid rgba(34,211,238,0.12)', padding: '0.72rem',
                  marginBottom: '0.2rem',
                }}>
                  {pendingVerificationEmail && <span style={{ color: 'rgba(34,211,238,0.7)', display: 'block', marginBottom: '0.3rem' }}>{pendingVerificationEmail}</span>}
                  请输入 6 位验证码（15 分钟内有效）
                </div>
                <PixelInput value={verifyCode_}
                  onChange={e => setVerifyCode_(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="请输入 6 位验证码"
                  maxLength={6} inputMode="numeric" autoComplete="one-time-code" />
                <div style={{ marginTop: '0.35rem' }}>
                  <PxBtn onClick={handleVerify} disabled={submitting || verifyCode_.length !== 6}>
                    {submitting ? '验证中...' : '验 证'}
                  </PxBtn>
                </div>
                <div style={{ textAlign: 'center', marginTop: '0.2rem' }}>
                  <button onClick={handleResend} disabled={resendCooldown > 0}
                    style={{ fontFamily: "'Departure Mono', monospace", fontSize: '0.56rem', letterSpacing: '0.08em',
                      color: resendCooldown > 0 ? 'rgba(212,216,224,0.2)' : 'rgba(34,211,238,0.48)',
                      background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'default' : 'pointer', padding: 0 }}>
                    {resendCooldown > 0 ? `${resendCooldown}s 后可重新发送` : '重新发送验证码'}
                  </button>
                </div>
              </>)}

              {/* FORGOT */}
              {authMode === 'forgot' && (<>
                <div>
                  <PixelInput value={forgotEmail}
                    onChange={e => setForgotEmail(e.target.value)}
                    onBlur={() => markTouched('forgot-email')}
                    placeholder="注册时使用的邮箱地址"
                    hasError={!!(touched['forgot-email'] && validateEmail(forgotEmail))} />
                  {touched['forgot-email'] && validateEmail(forgotEmail) && <p style={ERR}>{validateEmail(forgotEmail)}</p>}
                </div>
                <div style={{ marginTop: '0.35rem' }}>
                  <PxBtn onClick={handleForgot} disabled={submitting}>
                    {submitting ? '发送中...' : '发送重置链接'}
                  </PxBtn>
                </div>
              </>)}

              {/* RESET */}
              {authMode === 'reset' && (<>
                <div>
                  <PixelInput value={resetForm.password} type="password"
                    onChange={e => setResetForm(p => ({ ...p, password: e.target.value }))}
                    onBlur={() => markTouched('reset-password')}
                    placeholder="新密码（至少 8 位）"
                    hasError={!!(touched['reset-password'] && validatePassword(resetForm.password))} />
                  {touched['reset-password'] && validatePassword(resetForm.password) && <p style={ERR}>{validatePassword(resetForm.password)}</p>}
                </div>
                <div>
                  <PixelInput value={resetForm.confirm} type="password"
                    onChange={e => setResetForm(p => ({ ...p, confirm: e.target.value }))}
                    onBlur={() => markTouched('reset-confirm')}
                    placeholder="确认新密码"
                    hasError={!!(touched['reset-confirm'] && resetForm.password !== resetForm.confirm)} />
                  {touched['reset-confirm'] && resetForm.password !== resetForm.confirm && <p style={ERR}>两次密码不一致</p>}
                </div>
                <div style={{ marginTop: '0.35rem' }}>
                  <PxBtn onClick={handleReset} disabled={submitting}>
                    {submitting ? '重置中...' : '确认重置密码'}
                  </PxBtn>
                </div>
              </>)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
