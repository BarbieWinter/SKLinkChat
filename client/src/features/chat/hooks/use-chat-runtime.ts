import { useEffect, useMemo, useRef } from 'react'
import { useQueryClient } from 'react-query'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'
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
  const { authSession, refreshSession } = useAuth()
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
    resetSession
  } = useAppStore()

  const enabled = authSession.authenticated && authSession.email_verified && !authSession.chat_access_restricted
  const wasEnabledRef = useRef(false)
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
      wasEnabledRef.current = true
      return
    }

    // Only tear down when transitioning from enabled → disabled (logout / restriction).
    // Skip the initial mount where auth is still loading — otherwise we'd nuke the
    // stored session ID and lose the ability to reconnect after a page refresh.
    if (!wasEnabledRef.current) {
      return
    }

    wasEnabledRef.current = false
    clear()
    clearChatConnection()
    resetSession()
    clearStoredSessionId()
  }, [clear, clearChatConnection, enabled, resetSession])

  usePageCloseSignal({ sessionId })

  const socketActions = useChatSocket({
    sessionId,
    meId: me?.id,
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
    onIncomingMessage: ({ id, name, message, gender }) =>
      addMessage({
        sender: id === sessionId ? 'me' : name,
        senderId: id,
        gender,
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
    onSocketClosed: (code, reason) => {
      if (code === 1008 && reason === 'CHAT_ACCESS_RESTRICTED') {
        void refreshSession()
      }
    }
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
          senderId: sessionId,
          gender: me?.gender ?? authSession.gender,
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
      authSession.gender,
      retry,
      sessionId,
      socketActions,
      stranger,
      t,
      toast
    ]
  )
}
