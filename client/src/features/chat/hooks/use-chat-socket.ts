import { useEffect, useMemo, useRef } from 'react'

import useWebSocket, { ReadyState } from 'react-use-websocket'

import { getSocketUrl, toUser } from '@/features/chat/services/protocol'
import { ChatTransportStatus } from '@/features/chat/model/runtime'
import { WS_ENDPOINT } from '@/shared/config/runtime'
import { PayloadType, PresenceCountPayload, UserState } from '@/shared/types'

const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type UseChatSocketOptions = {
  sessionId: string
  meId?: string
  displayName: string
  meName?: string
  strangerId?: string
  onBootstrapError: () => void
  onDisconnect: () => void
  onSystemMessage: (message: string) => void
  onIncomingMessage: (payload: { name: string; message: string }) => void
  onUserInfo: (payload: unknown) => void
  onMatch: (payload: unknown) => void
  onErrorMessage: (message: string) => void
  onTyping: (typing: boolean) => void
  onPresenceCount: (onlineCount: number) => void
  syncDisplayName: (name: string) => void
}

export const useChatSocket = ({
  sessionId,
  meId,
  displayName,
  meName,
  strangerId,
  onBootstrapError,
  onDisconnect,
  onSystemMessage,
  onIncomingMessage,
  onUserInfo,
  onMatch,
  onErrorMessage,
  onTyping,
  onPresenceCount,
  syncDisplayName
}: UseChatSocketOptions) => {
  const hasConnectedRef = useRef(false)
  const socket = useWebSocket(
    sessionId ? getSocketUrl(WS_ENDPOINT, sessionId) : null,
    {
      shouldReconnect: () => true,
      onMessage: (event) => {
        const data = JSON.parse(event.data) as { type: PayloadType; payload: any }

        switch (data.type) {
          case PayloadType.Disconnect:
            onDisconnect()
            onSystemMessage('system.strangerDisconnected')
            break
          case PayloadType.Message:
            onIncomingMessage({
              name: data.payload.name,
              message: data.payload.message
            })
            break
          case PayloadType.UserInfo: {
            const user = toUser(data.payload)
            if (!user) {
              return
            }

            onUserInfo(user)
            // Only trigger disconnect when returning to idle (not when searching)
            if (user.state === UserState.Idle) {
              onDisconnect()
            }
            break
          }
          case PayloadType.Match: {
            const user = toUser(data.payload)
            if (user) {
              onMatch(user)
            }
            break
          }
          case PayloadType.Error:
            if (data.payload === 'Client not found') {
              onDisconnect()
              onSystemMessage('system.strangerDisconnected')
              break
            }

            onErrorMessage(String(data.payload))
            break
          case PayloadType.Typing:
            onTyping(Boolean(data.payload.typing))
            break
          case PayloadType.PresenceCount:
            onPresenceCount((data.payload as PresenceCountPayload).online_count)
            break
        }
      }
    },
    Boolean(sessionId)
  )

  useEffect(() => {
    if (!sessionId) {
      hasConnectedRef.current = false
      return
    }

    if (socket.readyState === ReadyState.OPEN) {
      hasConnectedRef.current = true
    }
  }, [sessionId, socket.readyState])

  const transportStatus = useMemo<ChatTransportStatus>(() => {
    if (!sessionId) {
      return 'idle'
    }

    switch (socket.readyState) {
      case ReadyState.OPEN:
        return 'connected'
      case ReadyState.CONNECTING:
        return hasConnectedRef.current ? 'reconnecting' : 'connecting'
      case ReadyState.CLOSING:
      case ReadyState.CLOSED:
        return hasConnectedRef.current ? 'reconnecting' : 'connecting'
      case ReadyState.UNINSTANTIATED:
      default:
        return 'connecting'
    }
  }, [sessionId, socket.readyState])

  useEffect(() => {
    if (!meId || !displayName || meName === displayName) {
      return
    }

    syncDisplayName(displayName)
    socket.sendJsonMessage({
      id: meId,
      type: PayloadType.UserInfo,
      payload: { name: displayName }
    })
  }, [displayName, meId, meName, socket, syncDisplayName])

  return {
    transportStatus,
    emitTyping: (typing: boolean) => {
      if (!strangerId) {
        return
      }

      socket.sendJsonMessage({
        type: PayloadType.Typing,
        payload: {
          id: strangerId,
          typing
        }
      })
    },
    sendMessage: (message: string) => {
      if (!strangerId) {
        return
      }

      socket.sendJsonMessage({
        type: PayloadType.Message,
        payload: {
          id: strangerId,
          message,
          client_message_id: createClientMessageId()
        }
      })
    },
    connect: () => {
      if (!meId) {
        onBootstrapError()
        return
      }

      socket.sendJsonMessage({
        type: PayloadType.Queue,
        payload: {
          id: meId
        }
      })
    },
    setName: (name: string) => {
      socket.sendJsonMessage({
        id: meId,
        type: PayloadType.UserInfo,
        payload: { name }
      })
    }
  }
}
