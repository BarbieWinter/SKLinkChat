import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'

import { TURNSTILE_ENABLED, TURNSTILE_SITE_KEY } from '@/shared/config/runtime'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          theme?: 'light' | 'dark' | 'auto'
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      reset?: (widgetId?: string) => void
      remove?: (widgetId: string) => void
    }
  }
}

export type TurnstileFieldHandle = {
  reset: () => void
}

type TurnstileFieldProps = {
  onTokenChange: (token: string) => void
  onExpired?: () => void
  onError?: (message: string) => void
}

let turnstileScriptPromise: Promise<void> | null = null

const ensureTurnstileScript = async () => {
  if (!TURNSTILE_SITE_KEY || typeof document === 'undefined') {
    return
  }

  if (window.turnstile) {
    return
  }

  if (!turnstileScriptPromise) {
    turnstileScriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
      script.async = true
      script.defer = true
      script.onload = () => resolve()
      script.onerror = () => {
        turnstileScriptPromise = null
        reject(new Error('Failed to load Turnstile script'))
      }
      document.head.appendChild(script)
    })
  }

  await turnstileScriptPromise
}

export const TurnstileField = forwardRef<TurnstileFieldHandle, TurnstileFieldProps>(
  ({ onTokenChange, onExpired, onError }, ref) => {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const widgetIdRef = useRef<string | null>(null)
    const onTokenChangeRef = useRef(onTokenChange)
    const onExpiredRef = useRef(onExpired)
    const onErrorRef = useRef(onError)

    onTokenChangeRef.current = onTokenChange
    onExpiredRef.current = onExpired
    onErrorRef.current = onError

    useImperativeHandle(
      ref,
      () => ({
        reset: () => {
          if (!TURNSTILE_ENABLED) {
            onTokenChangeRef.current('turnstile-disabled')
            return
          }

          onTokenChangeRef.current('')
          if (widgetIdRef.current && window.turnstile?.reset) {
            window.turnstile.reset(widgetIdRef.current)
          }
        }
      }),
      []
    )

    useEffect(() => {
      if (!TURNSTILE_ENABLED) {
        onTokenChangeRef.current('turnstile-disabled')
        return
      }

      if (!TURNSTILE_SITE_KEY) {
        onTokenChangeRef.current('')
        onErrorRef.current?.('Turnstile site key 未配置，暂时无法进行人机校验。')
        return
      }

      let cancelled = false

      const renderWidget = async () => {
        try {
          await ensureTurnstileScript()
          if (cancelled || !containerRef.current || !window.turnstile) {
            return
          }

          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: TURNSTILE_SITE_KEY,
            theme: 'dark',
            callback: (token) => onTokenChangeRef.current(token),
            'expired-callback': () => {
              onTokenChangeRef.current('')
              onExpiredRef.current?.()
            },
            'error-callback': () => {
              onTokenChangeRef.current('')
              onErrorRef.current?.('人机校验失败，请重试。')
            }
          })
        } catch {
          onTokenChangeRef.current('')
          onErrorRef.current?.('Turnstile 脚本加载失败，请刷新后重试。')
        }
      }

      void renderWidget()

      return () => {
        cancelled = true
        if (widgetIdRef.current && window.turnstile?.remove) {
          window.turnstile.remove(widgetIdRef.current)
          widgetIdRef.current = null
        }
      }
    }, [])

    if (!TURNSTILE_ENABLED) {
      return null
    }

    if (!TURNSTILE_SITE_KEY) {
      return <p className="text-[13px] leading-6 text-destructive">Turnstile site key 未配置。</p>
    }

    return <div ref={containerRef} />
  }
)

TurnstileField.displayName = 'TurnstileField'
