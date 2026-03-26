import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

import { ChatWorkspace } from '@/features/chat/ui/chat-workspace'
import { UserState } from '@/shared/types'

const authState: any = {
  authSession: {
    authenticated: true,
    email_verified: true,
    display_name: 'Admin',
    short_id: '483921',
    interests: [],
    is_admin: false,
    chat_access_restricted: false
  },
  logout: vi.fn()
}

const chatState: any = {
  me: { id: 'me-1', name: 'Admin', state: UserState.Idle },
  stranger: undefined,
  sessionId: 'session-1',
  availability: 'ready',
  bootstrapStatus: 'ready',
  transportStatus: 'connected'
}

const appState: any = {
  keywords: []
}

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => authState
}))

vi.mock('@/features/chat/chat-provider', () => ({
  useChat: () => chatState
}))

vi.mock('@/app/store', () => ({
  useAppStore: () => appState
}))

vi.mock('@/features/settings/ui/settings-dialog', () => ({
  default: () => <div data-testid="settings-dialog">settings</div>
}))

vi.mock('@/features/chat/ui/chat-panel', () => ({
  default: () => <div data-testid="chat-panel">chat panel</div>
}))

vi.mock('@/features/chat/ui/chat-report-dialog', () => ({
  default: () => <div data-testid="chat-report-dialog">report</div>
}))

vi.mock('@/shared/i18n/use-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'home.profile': '我的资料',
        'home.currentPartner': '当前聊天对象',
        'home.noPartner': '暂无聊天对象',
        'home.noPartnerDescription': '还没有匹配到聊天对象',
        'home.interestsEmpty': '暂无兴趣标签'
      }
      return translations[key] ?? key
    },
    formatUserState: (state?: UserState) => {
      switch (state) {
        case UserState.Connected:
          return '已连接'
        case UserState.Searching:
          return '匹配中'
        case UserState.Idle:
        default:
          return '空闲'
      }
    }
  })
}))

describe('ChatWorkspace', () => {
  beforeEach(() => {
    authState.authSession = {
      authenticated: true,
      email_verified: true,
      display_name: 'Admin',
      short_id: '483921',
      interests: [],
      is_admin: false,
      chat_access_restricted: false
    }
    authState.logout.mockReset()
    chatState.me = { id: 'me-1', name: 'Admin', state: UserState.Idle }
    chatState.stranger = undefined
    chatState.sessionId = 'session-1'
    chatState.availability = 'ready'
    chatState.bootstrapStatus = 'ready'
    chatState.transportStatus = 'connected'
    appState.keywords = []
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: 1400
    })
  })

  it('shows an admin console entry for admin accounts', () => {
    authState.authSession.is_admin = true

    render(
      <MemoryRouter>
        <ChatWorkspace />
      </MemoryRouter>
    )

    expect(screen.getByTestId('enter-admin-console')).toHaveAttribute('href', '/admin/reports')
  })

  it('hides the admin console entry for normal accounts', () => {
    render(
      <MemoryRouter>
        <ChatWorkspace />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('enter-admin-console')).not.toBeInTheDocument()
  })

  it('shows short ids for the current user and partner', () => {
    chatState.me = { id: 'session-1', name: 'Admin', state: UserState.Connected }
    chatState.stranger = { id: 'session-2', name: 'Alex', shortId: '654321', state: UserState.Connected }

    render(
      <MemoryRouter>
        <ChatWorkspace />
      </MemoryRouter>
    )

    expect(screen.getByText('ID: 483921')).toBeInTheDocument()
    expect(screen.getByText('ID: 654321')).toBeInTheDocument()
  })

  it('hides the report entry until the chat transport is fully connected', () => {
    chatState.me = { id: 'me-1', name: 'Admin', state: UserState.Connected }
    chatState.stranger = { id: 'partner-1', name: 'Alex', state: UserState.Connected }
    chatState.transportStatus = 'reconnecting'

    render(
      <MemoryRouter>
        <ChatWorkspace />
      </MemoryRouter>
    )

    expect(screen.queryByTestId('chat-report-dialog')).not.toBeInTheDocument()
  })
})
