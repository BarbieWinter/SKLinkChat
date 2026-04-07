import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react'

import { type GeeTestCaptchaPayload } from '@/features/auth/api/auth-client'
import { GEETEST_ENABLED } from '@/shared/config/runtime'
import { cn } from '@/shared/lib/utils'

declare global {
  interface Window {
    initGeetest4?: (
      config: {
        captchaId: string
        product?: 'bind'
        language?: string
      },
      callback: (captcha: GeeTestWidget) => void
    ) => void
  }
}

type GeeTestWidget = {
  getValidate: () => GeeTestCaptchaPayload | null
  showCaptcha?: () => void
  onReady?: (callback: () => void) => GeeTestWidget
  onSuccess: (callback: () => void) => GeeTestWidget
  onError: (callback: () => void) => GeeTestWidget
  reset: () => void
  destroy?: () => void
}

export type GeeTestFieldHandle = {
  reset: () => void
}

type GeeTestFieldProps = {
  captchaId: string
  onValidateChange: (payload: GeeTestCaptchaPayload | null) => void
  onError?: (message: string) => void
}

const DISABLED_CAPTCHA_PAYLOAD: GeeTestCaptchaPayload = {
  lot_number: 'geetest-disabled',
  captcha_output: 'geetest-disabled',
  pass_token: 'geetest-disabled',
  gen_time: '0'
}

let geetestScriptPromise: Promise<void> | null = null

const ensureGeeTestScript = async () => {
  if (typeof document === 'undefined') {
    return
  }

  if (window.initGeetest4) {
    return
  }

  if (!geetestScriptPromise) {
    geetestScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://static.geetest.com/v4/gt4.js'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        geetestScriptPromise = null
        reject(new Error('Failed to load GeeTest script'))
      }
      document.head.appendChild(script)
    })
  }

  await geetestScriptPromise
}

export const GeeTestField = forwardRef<GeeTestFieldHandle, GeeTestFieldProps>(
  ({ captchaId, onValidateChange, onError }, ref) => {
    const widgetRef = useRef<GeeTestWidget | null>(null)
    const onValidateChangeRef = useRef(onValidateChange)
    const onErrorRef = useRef(onError)
    const [status, setStatus] = useState<'loading' | 'ready' | 'opening' | 'success'>('loading')

    onValidateChangeRef.current = onValidateChange
    onErrorRef.current = onError

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (!GEETEST_ENABLED) {
            onValidateChangeRef.current(DISABLED_CAPTCHA_PAYLOAD)
            return
          }
          onValidateChangeRef.current(null)
          widgetRef.current?.reset()
          setStatus('ready')
        }
      }),
      []
    )

    useEffect(() => {
      if (!GEETEST_ENABLED) {
        onValidateChangeRef.current(DISABLED_CAPTCHA_PAYLOAD)
        return
      }

      if (!captchaId) {
        onValidateChangeRef.current(null)
        setStatus('ready')
        onErrorRef.current?.('GeeTest captcha_id 未配置，暂时无法进行人机校验。')
        return
      }

      let cancelled = false
      setStatus('loading')
      onValidateChangeRef.current(null)

      const mountCaptcha = async () => {
        try {
          await ensureGeeTestScript()
          if (cancelled || !window.initGeetest4) {
            return
          }

          await new Promise<void>((resolve) => {
            window.initGeetest4?.(
              {
                captchaId,
                product: 'bind',
                language: 'zho'
              },
              (captcha) => {
                if (cancelled) {
                  captcha.destroy?.()
                  resolve()
                  return
                }

                widgetRef.current = captcha
                captcha.onReady?.(() => {
                  setStatus((current) => (current === 'opening' ? current : 'ready'))
                })
                captcha.onSuccess(() => {
                  const payload = captcha.getValidate()
                  if (!payload) {
                    onValidateChangeRef.current(null)
                    setStatus('ready')
                    onErrorRef.current?.('极验校验结果读取失败，请重试。')
                    return
                  }
                  onValidateChangeRef.current(payload)
                  setStatus('success')
                })
                captcha.onError(() => {
                  onValidateChangeRef.current(null)
                  setStatus('ready')
                  onErrorRef.current?.('人机校验失败，请重试。')
                })
                setStatus('ready')
                resolve()
              }
            )
          })
        } catch {
          onValidateChangeRef.current(null)
          setStatus('ready')
          onErrorRef.current?.('GeeTest 脚本加载失败，请刷新后重试。')
        }
      }

      void mountCaptcha()

      return () => {
        cancelled = true
        onValidateChangeRef.current(null)
        widgetRef.current?.destroy?.()
        widgetRef.current = null
      }
    }, [captchaId])

    if (!GEETEST_ENABLED) {
      return null
    }

    if (!captchaId) {
      return <p className="text-[13px] leading-6 text-destructive">GeeTest captcha_id 未配置。</p>
    }

    const isLoading = status === 'loading'
    const isSuccess = status === 'success'
    const isOpening = status === 'opening'
    const statusLabel = isLoading ? '系统准备中' : isOpening ? '验证窗口已打开' : isSuccess ? '验证已完成' : '待完成'
    const statusClassName = isSuccess
      ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200'
      : isOpening
        ? 'border-cyan-400/25 bg-cyan-400/10 text-cyan-100'
        : isLoading
          ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
          : 'border-amber-400/20 bg-amber-400/10 text-amber-100'

    return (
      <div className="relative overflow-hidden rounded-[24px] border border-slate-800/80 bg-[linear-gradient(135deg,rgba(10,15,28,0.96),rgba(12,20,37,0.72))] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.13),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(16,185,129,0.08),transparent_30%)]" />
        <div className="relative flex min-h-[212px] flex-col gap-4">
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] text-sky-100">
                <Sparkles className="h-3.5 w-3.5" />
                Step 1
              </div>
              <div
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-medium',
                  statusClassName
                )}
              >
                {isLoading || isOpening ? (
                  <Loader2 className={cn('h-3.5 w-3.5', isLoading || isOpening ? 'animate-spin' : '')} />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {statusLabel}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-sky-400/12 text-sky-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div>
                <p className="text-[15px] font-semibold tracking-[0.01em] text-slate-50">安全验证</p>
                <p className="mt-1 text-[13px] leading-6 text-slate-400">
                  {isSuccess
                    ? '验证已经通过，当前提交链路已解锁。'
                    : isOpening
                      ? '验证窗口已经唤起，请在弹窗内完成验证。'
                      : '先完成一次安全验证，再继续注册或登录提交。'}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-auto pt-2">
            <button
              type="button"
              className={cn(
                'inline-flex w-full items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-[14px] font-medium transition-all',
                isSuccess
                  ? 'cursor-default border-emerald-500/35 bg-emerald-500/12 text-emerald-200'
                  : isOpening
                    ? 'border-cyan-400/35 bg-cyan-400/10 text-cyan-50'
                    : 'border-sky-400/35 bg-[linear-gradient(135deg,rgba(59,130,246,0.18),rgba(34,211,238,0.14))] text-sky-50 hover:border-sky-300/55 hover:bg-[linear-gradient(135deg,rgba(59,130,246,0.25),rgba(34,211,238,0.18))]',
                isLoading && 'cursor-wait opacity-70'
              )}
              disabled={isLoading || isSuccess}
              onClick={() => {
                if (!widgetRef.current?.showCaptcha) {
                  onErrorRef.current?.('极验尚未准备完成，请稍后重试。')
                  return
                }
                setStatus('opening')
                widgetRef.current.showCaptcha()
              }}
            >
              {isLoading || isOpening ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : isSuccess ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <ShieldCheck className="h-4 w-4" />
              )}
              {isLoading
                ? '正在加载...'
                : isOpening
                  ? '验证窗口已打开'
                  : isSuccess
                    ? '安全验证已完成'
                    : '点击完成安全验证'}
            </button>
          </div>
        </div>
      </div>
    )
  }
)

GeeTestField.displayName = 'GeeTestField'
