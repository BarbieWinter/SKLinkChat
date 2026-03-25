/**
 * Thin chat provider that composes session bootstrap, socket lifecycle, and store updates.
 */
import React, { createContext, useContext, useMemo } from 'react'
import { useQueryClient } from 'react-query'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { useSessionBootstrap } from '@/features/chat/hooks/use-session-bootstrap'
import { usePageCloseSignal } from '@/features/chat/hooks/use-page-close-signal'
import { useChatSocket } from '@/features/chat/hooks/use-chat-socket'
import { ONLINE_USER_COUNT_QUERY_KEY } from '@/features/presence/api/get-online-count'
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
  isBootstrapping: boolean
  isAvailable: boolean
  retryBootstrap?: () => void
}

const initialState: ChatProviderState = {
  sendMessage: undefined,
  connect: undefined,
  setName: undefined,
  stranger: undefined,
  me: undefined,
  emitTyping: undefined,
  isBootstrapping: true,
  isAvailable: true,
  retryBootstrap: undefined
}

const ChatProviderContext = createContext<ChatProviderState>(initialState)

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useI18n()
  const { authSession } = useAuth()
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
  const { retry, sessionId, status } = useSessionBootstrap({
    enabled: authSession.authenticated && authSession.email_verified,
    onError: () => undefined
  })
  usePageCloseSignal({ sessionId })
  const isBootstrapping = status === 'bootstrapping'
  const isAvailable = status !== 'error'
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
      if ((user as User).state === UserState.Idle) {
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
    onPresenceCount: (onlineCount) => {
      queryClient.setQueryData(ONLINE_USER_COUNT_QUERY_KEY, onlineCount)
    },
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
        if (!isAvailable) {
          toast({
            title: t('common.error'),
            description: t('chat.serviceUnavailable'),
            variant: 'destructive'
          })
          return
        }

        if (!me?.id) {
          toast({
            title: t('common.error'),
            description: t('chat.serviceStarting'),
            variant: 'destructive'
          })
          return
        }

        clearChatConnection()
        socketActions.connect()
      },
      setName: socketActions.setName,
      stranger,
      me,
      isBootstrapping,
      isAvailable,
      retryBootstrap: retry
    }),
    [addMessage, clear, clearChatConnection, isAvailable, isBootstrapping, me, retry, socketActions, stranger, t, toast]
  )

  return <ChatProviderContext.Provider value={value}>{children}</ChatProviderContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatProviderContext)
  if (context === undefined) throw new Error('useChat must be used within a ChatProvider')
  return context
}
