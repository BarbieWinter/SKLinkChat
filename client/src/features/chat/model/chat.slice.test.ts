import { useAppStore } from '@/app/store'
import { UserState } from '@/shared/types'

describe('chat runtime store behavior', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAppStore.setState({
      ...useAppStore.getState(),
      messages: [],
      me: undefined,
      stranger: undefined
    })
  })

  it('appends messages, updates typing, and clears the active chat connection', () => {
    useAppStore.getState().addMessage({ sender: 'me', message: 'hello' })
    useAppStore.getState().setStranger({
      id: 'partner-1',
      name: 'Partner',
      state: UserState.Connected
    })
    useAppStore.getState().setStrangerTyping(true)
    useAppStore.getState().clearChatConnection()

    expect(useAppStore.getState().messages).toEqual([])
    expect(useAppStore.getState().stranger).toBeUndefined()
  })
})
