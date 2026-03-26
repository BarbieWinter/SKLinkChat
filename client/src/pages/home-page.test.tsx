import { render, screen } from '@testing-library/react'

import HomePage from '@/pages/home-page'

const authState: any = {
  authSession: {
    authenticated: false,
    email_verified: false,
    display_name: null,
    interests: []
  },
  status: 'ready'
}

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => authState
}))

vi.mock('@/features/auth/ui/auth-entry-card', () => ({
  AuthEntryCard: () => <div data-testid="auth-entry-card">auth entry</div>
}))

vi.mock('@/features/auth/ui/email-verification-pending-card', () => ({
  EmailVerificationPendingCard: () => <div data-testid="email-verification-card">email verification</div>
}))

vi.mock('@/features/chat/ui/chat-workspace', () => ({
  ChatWorkspace: () => <div data-testid="chat-workspace">chat workspace</div>
}))

describe('HomePage', () => {
  beforeEach(() => {
    authState.authSession = {
      authenticated: false,
      email_verified: false,
      display_name: null,
      interests: []
    }
    authState.status = 'ready'
  })

  it('switches between auth, verification, and chat containers as auth state changes', () => {
    const { rerender } = render(<HomePage />)

    expect(screen.getByTestId('auth-entry-card')).toBeInTheDocument()

    authState.authSession = {
      authenticated: true,
      email_verified: false,
      display_name: 'Alice',
      interests: []
    }
    rerender(<HomePage />)

    expect(screen.getByTestId('email-verification-card')).toBeInTheDocument()

    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Alice',
      interests: []
    }
    rerender(<HomePage />)

    expect(screen.getByTestId('chat-workspace')).toBeInTheDocument()
  })

  it('shows the loading gate while auth session bootstrap is in progress', () => {
    authState.status = 'loading'

    render(<HomePage />)

    expect(screen.getByText('正在加载账户状态...')).toBeInTheDocument()
  })
})
