import { render, waitFor } from '@testing-library/react'

import { TurnstileField } from '@/features/auth/turnstile-field'

vi.mock('@/shared/config/runtime', () => ({
  TURNSTILE_ENABLED: true,
  TURNSTILE_SITE_KEY: 'test-site-key'
}))

type TurnstileRenderOptions = {
  callback: (token: string) => void
  'expired-callback'?: () => void
  'error-callback'?: () => void
}

describe('TurnstileField', () => {
  let renderSpy: ReturnType<typeof vi.fn>
  let removeSpy: ReturnType<typeof vi.fn>
  let resetSpy: ReturnType<typeof vi.fn>
  let latestOptions: TurnstileRenderOptions | null

  beforeEach(() => {
    latestOptions = null
    renderSpy = vi.fn((_container: HTMLElement, options: TurnstileRenderOptions) => {
      latestOptions = options
      return 'widget-1'
    })
    removeSpy = vi.fn()
    resetSpy = vi.fn()
    window.turnstile = {
      render: renderSpy,
      remove: removeSpy,
      reset: resetSpy
    }
  })

  afterEach(() => {
    delete window.turnstile
  })

  it('keeps the widget mounted when parent callbacks get new identities', async () => {
    const { rerender, unmount } = render(
      <TurnstileField onTokenChange={() => undefined} onExpired={() => undefined} onError={() => undefined} />
    )

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })

    rerender(<TurnstileField onTokenChange={() => undefined} onExpired={() => undefined} onError={() => undefined} />)

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1)
    })
    expect(removeSpy).not.toHaveBeenCalled()

    unmount()

    expect(removeSpy).toHaveBeenCalledWith('widget-1')
  })

  it('uses the latest callback props without remounting the widget', async () => {
    const firstTokenChange = vi.fn()
    const nextTokenChange = vi.fn()

    const { rerender } = render(<TurnstileField onTokenChange={firstTokenChange} />)

    await waitFor(() => {
      expect(renderSpy).toHaveBeenCalledTimes(1)
      expect(latestOptions).not.toBeNull()
    })

    rerender(<TurnstileField onTokenChange={nextTokenChange} />)

    latestOptions?.callback('verified-token')

    expect(firstTokenChange).not.toHaveBeenCalled()
    expect(nextTokenChange).toHaveBeenCalledWith('verified-token')
    expect(renderSpy).toHaveBeenCalledTimes(1)
  })
})
