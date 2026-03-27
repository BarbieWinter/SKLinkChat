import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import React from 'react'

import { AuthEntryCard } from '@/features/auth/ui/auth-entry-card'

const toastSpy = vi.fn()
const registerSpy = vi.fn()
const loginSpy = vi.fn()
const resendSpy = vi.fn()

const authState = {
  login: loginSpy,
  register: registerSpy,
  verifyCode: vi.fn(),
  resendCode: resendSpy,
  pendingVerificationEmail: null as string | null,
  setPendingVerificationEmail: vi.fn()
}

vi.mock('framer-motion', () => {
  const motion = new Proxy(
    {},
    {
      get: (_, tag: string) =>
        React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(({ children, ...props }, ref) => {
          const {
            animate: _animate,
            exit: _exit,
            initial: _initial,
            transition: _transition,
            whileHover: _whileHover,
            whileTap: _whileTap,
            ...domProps
          } = props as React.HTMLAttributes<HTMLElement> & {
            animate?: unknown
            exit?: unknown
            initial?: unknown
            transition?: unknown
            whileHover?: unknown
            whileTap?: unknown
          }

          return React.createElement(tag, { ...domProps, ref }, children)
        })
    }
  )

  return {
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    motion
  }
})

vi.mock('unique-username-generator', () => ({
  generateUsername: () => 'Traveler'
}))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => authState
}))

vi.mock('@/shared/ui/use-toast', () => ({
  useToast: () => ({ toast: toastSpy })
}))

vi.mock('@/shared/i18n/use-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

vi.mock('@/features/auth/api/auth-client', () => ({
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn()
}))

vi.mock('@/features/auth/geetest-field', () => {
  const GeeTestField = React.forwardRef<
    { reset: () => void },
    {
      captchaId: string
      onValidateChange: (payload: {
        lot_number: string
        captcha_output: string
        pass_token: string
        gen_time: string
      } | null) => void
      onError?: (message: string) => void
    }
  >(({ onValidateChange, onError }, ref) => {
    React.useImperativeHandle(ref, () => ({
      reset: () => onValidateChange(null)
    }))

    return (
      <div data-testid="geetest-field">
        <button
          type="button"
          onClick={() =>
            onValidateChange({
              lot_number: 'lot-1',
              captcha_output: 'output-1',
              pass_token: 'pass-1',
              gen_time: '1000'
            })
          }
        >
          issue geetest payload
        </button>
        <button type="button" onClick={() => onError?.('人机校验失败，请重试。')}>
          fail geetest
        </button>
      </div>
    )
  })

  return { GeeTestField }
})

describe('AuthEntryCard geetest integration', () => {
  beforeEach(() => {
    toastSpy.mockReset()
    registerSpy.mockReset()
    loginSpy.mockReset()
    resendSpy.mockReset()
    authState.pendingVerificationEmail = null
    window.history.replaceState({}, '', '/')
  })

  it('blocks register submit before captcha validation is available', async () => {
    render(<AuthEntryCard />)

    fireEvent.change(screen.getByPlaceholderText('邮箱地址'), { target: { value: 'user@testuser.dev' } })
    fireEvent.change(screen.getByPlaceholderText('密码（至少 8 位）'), { target: { value: 'CorrectHorseBatteryStaple!23' } })
    fireEvent.click(screen.getByRole('button', { name: '注册并发送验证码' }))

    expect(registerSpy).not.toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '请先完成人机校验。',
        variant: 'destructive'
      })
    )
  })

  it('blocks login submit before captcha validation is available', async () => {
    render(<AuthEntryCard />)

    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    fireEvent.change(screen.getByPlaceholderText('邮箱地址'), { target: { value: 'user@testuser.dev' } })
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'CorrectHorseBatteryStaple!23' } })
    fireEvent.click(screen.getAllByRole('button', { name: '登录' }).at(-1) as HTMLElement)

    expect(loginSpy).not.toHaveBeenCalled()
    expect(toastSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        description: '请先完成人机校验。',
        variant: 'destructive'
      })
    )
  })

  it('shows a clear message when geetest validation fails during login', async () => {
    loginSpy.mockRejectedValueOnce(Object.assign(new Error('GeeTest validation failed'), { code: 'GEETEST_VALIDATION_FAILED' }))

    render(<AuthEntryCard />)

    fireEvent.click(screen.getByRole('button', { name: '登录' }))
    fireEvent.change(screen.getByPlaceholderText('邮箱地址'), { target: { value: 'user@testuser.dev' } })
    fireEvent.change(screen.getByPlaceholderText('密码'), { target: { value: 'CorrectHorseBatteryStaple!23' } })
    fireEvent.click(screen.getByRole('button', { name: 'issue geetest payload' }))
    fireEvent.click(screen.getAllByRole('button', { name: '登录' }).at(-1) as HTMLElement)

    await waitFor(() => {
      expect(toastSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          description: '人机校验未通过，请重新完成验证。',
          variant: 'destructive'
        })
      )
    })
  })

  it('resends verification without requiring geetest again', async () => {
    authState.pendingVerificationEmail = 'user@testuser.dev'
    resendSpy.mockResolvedValueOnce(undefined)

    render(<AuthEntryCard />)

    fireEvent.click(screen.getByRole('button', { name: '重新发送验证码' }))

    await waitFor(() => {
      expect(resendSpy).toHaveBeenCalledWith({ email: 'user@testuser.dev' })
    })
  })
})
