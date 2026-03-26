import { fireEvent, render, screen } from '@testing-library/react'

import ChatPanel from '@/features/chat/ui/chat-panel'
import { UserState } from '@/shared/types'

const toast = vi.fn()

const chatState: any = {
  sendMessage: vi.fn(),
  stranger: undefined,
  me: undefined,
  connect: vi.fn(),
  emitTyping: vi.fn(),
  bootstrapStatus: 'ready',
  transportStatus: 'connected',
  availability: 'ready',
  retryBootstrap: vi.fn()
}

const appStoreState: any = {
  messages: [] as Array<{ sender: string; message: string }>
}

const translations: Record<string, string> = {
  'common.error': '错误',
  'home.reroll': '重新匹配',
  'chat.reconnecting': '连接已中断，正在恢复聊天连接。',
  'chat.serviceUnavailable': '聊天服务暂时不可用，请确认后端服务已启动。',
  'chat.serviceStarting': '聊天服务正在连接，请稍后再试。',
  'chat.retryConnection': '重新连接',
  'chat.notConnected': '你当前还没有连接到聊天对象。',
  'chat.strangerTyping': '对方正在输入...',
  'chat.emptyTitle': '还没有消息',
  'chat.emptyDescription': '开始匹配后发送第一条消息。',
  'chat.placeholder': '输入你想发送的内容',
  'home.startChat': '开始聊天',
  'home.searching': '匹配中...'
}

vi.mock('@/app/store', () => ({
  useAppStore: () => appStoreState
}))

vi.mock('@/features/chat/chat-provider', () => ({
  useChat: () => chatState
}))

vi.mock('@/app/mode-toggle', () => ({
  ModeToggle: () => <div data-testid="mode-toggle" />
}))

vi.mock('@/features/presence/ui/online-user-count', () => ({
  default: () => <div data-testid="online-user-count" />
}))

vi.mock('@/shared/ui/use-toast', () => ({
  useToast: () => ({ toast })
}))

vi.mock('@/shared/i18n/use-i18n', () => ({
  useI18n: () => ({
    t: (key: string) => translations[key] ?? key,
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

describe('ChatPanel', () => {
  beforeEach(() => {
    toast.mockReset()
    chatState.sendMessage.mockReset()
    chatState.connect.mockReset()
    chatState.emitTyping.mockReset()
    chatState.retryBootstrap.mockReset()
    chatState.stranger = undefined
    chatState.me = undefined
    chatState.bootstrapStatus = 'ready'
    chatState.transportStatus = 'connected'
    chatState.availability = 'ready'
    appStoreState.messages = []
  })

  it('shows bootstrap failure state and retries session bootstrap on demand', () => {
    chatState.availability = 'error'
    chatState.bootstrapStatus = 'error'

    render(<ChatPanel />)

    fireEvent.click(screen.getByRole('button', { name: '重新连接' }))

    expect(chatState.retryBootstrap).toHaveBeenCalledTimes(1)
    expect(screen.getByText('聊天服务暂时不可用，请确认后端服务已启动。')).toBeInTheDocument()
  })

  it('surfaces reconnecting status and disables message submission while transport recovers', () => {
    chatState.me = {
      id: 'me-1',
      name: 'Alice',
      state: UserState.Connected
    }
    chatState.stranger = {
      id: 'stranger-1',
      name: 'Bob',
      state: UserState.Connected
    }
    chatState.transportStatus = 'reconnecting'
    appStoreState.messages = [{ sender: 'Bob', message: 'hello' }]

    const { container } = render(<ChatPanel />)

    expect(screen.getAllByText('连接已中断，正在恢复聊天连接。').length).toBeGreaterThan(0)
    expect(container.querySelector('button[type="submit"]')).toBeDisabled()
  })
})
