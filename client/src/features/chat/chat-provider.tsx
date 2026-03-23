/**
 * Thin chat provider that composes session bootstrap, socket lifecycle, and store updates.
 */
import React, { createContext, useContext, useMemo } from 'react'

import { useAppStore } from '@/app/store'
import { useSessionBootstrap } from '@/features/chat/hooks/use-session-bootstrap'
import { useChatSocket } from '@/features/chat/hooks/use-chat-socket'
import { useI18n } from '@/shared/i18n/use-i18n'
import { User, UserState } from '@/shared/types'
import { useToast } from '@/shared/ui/use-toast'

type ChatProviderProps = {
  children: React.ReactNode
}

type ChatProviderState = {
  sendMessage?: (message: string) => void
  connect?: () => void
  setName?: (name: string) => void
  stranger?: User
  me?: User
  emitTyping?: (typing: boolean) => void
}

const initialState: ChatProviderState = {
  sendMessage: undefined,
  connect: undefined,
  setName: undefined,
  stranger: undefined,
  me: undefined,
  emitTyping: undefined
}

const ChatProviderContext = createContext<ChatProviderState>(initialState)

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const { toast } = useToast()
  const { t } = useI18n()
  const {
    addMessage,
    clear,
    clearChatConnection,
    setMe,
    setStranger,
    setStrangerTyping,
    me,
    stranger,
    disconnect,
    setName,
    displayName
  } = useAppStore()
  const sessionId = useSessionBootstrap({
    onError: () =>
      toast({
        title: t('common.error'),
        description: 'Failed to bootstrap chat session.',
        variant: 'destructive'
      })
  })
  const socketActions = useChatSocket({
    sessionId,
    meId: me?.id,
    meName: me?.name,
    displayName,
    strangerId: stranger?.id,
    onBootstrapError: () =>
      toast({
        title: t('common.error'),
        description: 'Failed to bootstrap chat session.',
        variant: 'destructive'
      }),
    onDisconnect: () => {
      disconnect()
      clear()
    },
    onSystemMessage: (messageKey) =>
      addMessage({
        sender: 'system',
        message: t(messageKey as 'system.strangerDisconnected')
      }),
    onIncomingMessage: ({ name, message }) =>
      addMessage({
        sender: name,
        message
      }),
    onUserInfo: (user) => {
      setMe(user as User)
      if ((user as User).state !== UserState.Connected) {
        clearChatConnection()
      }
    },
    onMatch: (user) => setStranger(user as User),
    onErrorMessage: (message) =>
      toast({
        title: t('common.error'),
        description: message,
        variant: 'destructive'
      }),
    onTyping: (typing) => setStrangerTyping(typing),
    syncDisplayName: (name) => setName(name)
  })

  const value = useMemo<ChatProviderState>(
    () => ({
      emitTyping: socketActions.emitTyping,
      sendMessage: (message: string) => {
        if (!stranger?.id) return
        socketActions.sendMessage(message)
        addMessage({
          sender: 'me',
          message
        })
      },
      connect: () => {
        clear()
        socketActions.connect()
      },
      setName: socketActions.setName,
      stranger,
      me
    }),
    [addMessage, clear, me, socketActions, stranger]
  )

  return <ChatProviderContext.Provider value={value}>{children}</ChatProviderContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatProviderContext)
  if (context === undefined) throw new Error('useChat must be used within a ChatProvider')
  return context
}
