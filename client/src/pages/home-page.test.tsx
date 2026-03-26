import { render, screen } from '@testing-library/react'

import HomePage from '@/pages/home-page'

const authState: any = {
  authSession: {
    authenticated: false,
    email_verified: false,
    display_name: null,
    short_id: null,
    interests: [],
    is_admin: false,
    chat_access_restricted: false
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

vi.mock('@/features/auth/ui/restricted-chat-access-card', () => ({
  RestrictedChatAccessCard: () => <div data-testid="restricted-chat-access-card">restricted</div>
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
      short_id: null,
      interests: [],
      is_admin: false,
      chat_access_restricted: false
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
      short_id: '123456',
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    }
    rerender(<HomePage />)

    expect(screen.getByTestId('email-verification-card')).toBeInTheDocument()

    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Alice',
      short_id: '123456',
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    }
    rerender(<HomePage />)

    expect(screen.getByTestId('chat-workspace')).toBeInTheDocument()
  })

  it('shows the restricted card when chat access is blocked', () => {
    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Alice',
      short_id: '123456',
      interests: [],
      is_admin: false,
      chat_access_restricted: true
    }

    render(<HomePage />)

    expect(screen.getByTestId('restricted-chat-access-card')).toBeInTheDocument()
  })

  it('shows the loading gate while auth session bootstrap is in progress', () => {
    authState.status = 'loading'

    render(<HomePage />)

    expect(screen.getByText('正在加载账户状态...')).toBeInTheDocument()
  })
})
