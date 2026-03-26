import { useEffect, useMemo } from 'react'
import { useQueryClient } from 'react-query'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { useSessionBootstrap } from '@/features/chat/hooks/use-session-bootstrap'
import { usePageCloseSignal } from '@/features/chat/hooks/use-page-close-signal'
import { useChatSocket } from '@/features/chat/hooks/use-chat-socket'
import {
  ChatRuntimeAvailability,
  ChatTransportStatus,
  SessionBootstrapStatus,
  getChatRuntimeAvailability
} from '@/features/chat/model/runtime'
import { ONLINE_USER_COUNT_QUERY_KEY } from '@/features/presence/api/get-online-count'
import { useI18n } from '@/shared/i18n/use-i18n'
import { User, UserState } from '@/shared/types'
import { useToast } from '@/shared/ui/use-toast'

export type ChatProviderState = {
  sendMessage?: (message: string) => void
  connect?: () => void
  setName?: (name: string) => void
  stranger?: User
  me?: User
  sessionId: string
  emitTyping?: (typing: boolean) => void
  bootstrapStatus: SessionBootstrapStatus
  transportStatus: ChatTransportStatus
  availability: ChatRuntimeAvailability
  retryBootstrap?: () => void
}

export const useChatRuntime = (): ChatProviderState => {
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
    displayName,
    resetSession
  } = useAppStore()

  const enabled = authSession.authenticated && authSession.email_verified
  const {
    retry,
    sessionId,
    status: bootstrapStatus
  } = useSessionBootstrap({
    enabled,
    onError: () => undefined
  })

  useEffect(() => {
    if (enabled) {
      return
    }

    clear()
    clearChatConnection()
    resetSession()
  }, [clear, clearChatConnection, enabled, resetSession])

  usePageCloseSignal({ sessionId })

  const socketActions = useChatSocket({
    sessionId,
    meId: me?.id,
    meName: me?.name,
    displayName,
    strangerId: stranger?.id,
    onBootstrapError: () =>
      toast({
        title: t('common.error'),
        description: t('chat.serviceStarting'),
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

  const availability = getChatRuntimeAvailability({ enabled, bootstrapStatus })

  return useMemo<ChatProviderState>(
    () => ({
      emitTyping: socketActions.emitTyping,
      sendMessage: (message: string) => {
        if (!stranger?.id || socketActions.transportStatus !== 'connected') {
          return
        }

        socketActions.sendMessage(message)
        addMessage({
          sender: 'me',
          message
        })
      },
      connect: () => {
        if (availability === 'error') {
          toast({
            title: t('common.error'),
            description: t('chat.serviceUnavailable'),
            variant: 'destructive'
          })
          return
        }

        if (availability === 'bootstrapping' || socketActions.transportStatus === 'connecting') {
          toast({
            title: t('common.error'),
            description: t('chat.serviceStarting'),
            variant: 'destructive'
          })
          return
        }

        if (socketActions.transportStatus === 'reconnecting') {
          toast({
            title: t('common.error'),
            description: t('chat.reconnecting'),
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
      sessionId,
      bootstrapStatus,
      transportStatus: socketActions.transportStatus,
      availability,
      retryBootstrap: retry
    }),
    [
      addMessage,
      availability,
      bootstrapStatus,
      clearChatConnection,
      me,
      retry,
      sessionId,
      socketActions,
      stranger,
      t,
      toast
    ]
  )
}
