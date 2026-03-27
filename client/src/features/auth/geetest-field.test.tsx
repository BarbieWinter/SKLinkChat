import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

import { GeeTestField } from '@/features/auth/geetest-field'

const initGeetest4Spy = vi.fn()

vi.mock('@/shared/config/runtime', () => ({
  GEETEST_ENABLED: true
}))

describe('GeeTestField', () => {
  beforeEach(() => {
    initGeetest4Spy.mockReset()
    window.initGeetest4 = initGeetest4Spy
  })

  afterEach(() => {
    delete window.initGeetest4
  })

  it('mounts GeeTest once per captcha id and forwards validate payloads', async () => {
    const onSuccessCallbacks: Array<() => void> = []
    const onReadyCallbacks: Array<() => void> = []
    const reset = vi.fn()
    const destroy = vi.fn()
    const showCaptcha = vi.fn()
    const onValidateChange = vi.fn()

    initGeetest4Spy.mockImplementation(
      (
        _config: { captchaId: string; product?: 'bind'; language?: string },
        callback: (captcha: {
          getValidate: () => { lot_number: string; captcha_output: string; pass_token: string; gen_time: string }
          showCaptcha: typeof showCaptcha
          onReady: (handler: () => void) => object
          onSuccess: (handler: () => void) => object
          onError: (handler: () => void) => object
          reset: typeof reset
          destroy: typeof destroy
        }) => void
      ) => {
        callback({
          getValidate: () => ({
            lot_number: 'lot-1',
            captcha_output: 'output-1',
            pass_token: 'pass-1',
            gen_time: '1000'
          }),
          showCaptcha,
          onReady: (handler) => {
            onReadyCallbacks.push(handler)
            return {} as object
          },
          onSuccess: (handler) => {
            onSuccessCallbacks.push(handler)
            return {} as object
          },
          onError: () => ({} as object),
          reset,
          destroy
        })
      }
    )

    const { rerender, unmount } = render(
      <GeeTestField captchaId="register-id" onValidateChange={onValidateChange} onError={() => undefined} />
    )

    await waitFor(() => {
      expect(initGeetest4Spy).toHaveBeenCalledTimes(1)
    })
    expect(initGeetest4Spy).toHaveBeenCalledWith(
      expect.objectContaining({ captchaId: 'register-id', product: 'bind', language: 'zho' }),
      expect.any(Function)
    )

    act(() => {
      onReadyCallbacks[0]?.()
    })
    expect(screen.getByRole('button', { name: '点击完成安全验证' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '点击完成安全验证' }))
    expect(showCaptcha).toHaveBeenCalledTimes(1)

    act(() => {
      onSuccessCallbacks[0]?.()
    })

    expect(onValidateChange).toHaveBeenLastCalledWith({
      lot_number: 'lot-1',
      captcha_output: 'output-1',
      pass_token: 'pass-1',
      gen_time: '1000'
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '安全验证已完成' })).toBeDisabled()
    })

    rerender(<GeeTestField captchaId="register-id" onValidateChange={onValidateChange} onError={() => undefined} />)
    expect(initGeetest4Spy).toHaveBeenCalledTimes(1)

    rerender(<GeeTestField captchaId="login-id" onValidateChange={onValidateChange} onError={() => undefined} />)

    await waitFor(() => {
      expect(initGeetest4Spy).toHaveBeenCalledTimes(2)
    })

    unmount()
    expect(destroy).toHaveBeenCalled()
  })
})
