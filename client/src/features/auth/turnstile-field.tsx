import { useEffect, useRef } from 'react'

import { TURNSTILE_SITE_KEY } from '@/shared/config/runtime'

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string
          callback: (token: string) => void
          'expired-callback'?: () => void
          'error-callback'?: () => void
        }
      ) => string
      remove?: (widgetId: string) => void
    }
  }
}

type TurnstileFieldProps = {
  onTokenChange: (token: string) => void
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
      script.onerror = () => reject(new Error('Failed to load Turnstile script'))
      document.head.appendChild(script)
    })
  }

  await turnstileScriptPromise
}

export const TurnstileField = ({ onTokenChange }: TurnstileFieldProps) => {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const widgetIdRef = useRef<string | null>(null)

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      onTokenChange('dev-turnstile-token')
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
          callback: (token) => onTokenChange(token),
          'expired-callback': () => onTokenChange(''),
          'error-callback': () => onTokenChange('')
        })
      } catch {
        onTokenChange('')
      }
    }

    void renderWidget()

    return () => {
      cancelled = true
      if (widgetIdRef.current && window.turnstile?.remove) {
        window.turnstile.remove(widgetIdRef.current)
      }
    }
  }, [onTokenChange])

  if (!TURNSTILE_SITE_KEY) {
    return null
  }

  return <div ref={containerRef} />
}
