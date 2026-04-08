import { useEffect, useMemo, useRef, useState } from 'react'

import useWebSocket, { ReadyState } from 'react-use-websocket'

import { getSocketUrl, toUser } from '@/features/chat/services/protocol'
import { ChatTransportStatus } from '@/features/chat/model/runtime'
import { WS_ENDPOINT } from '@/shared/config/runtime'
import { resolveStackAccessToken } from '@/shared/lib/auth-headers'
import { Gender, PayloadType, PresenceCountPayload, User, UserState } from '@/shared/types'

const createClientMessageId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `message-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

type UseChatSocketOptions = {
  sessionId: string
  meId?: string
  strangerId?: string
  onBootstrapError: () => void
  onDisconnect: () => void
  onSystemMessage: (message: string) => void
  onIncomingMessage: (payload: { id: string; name: string; message: string; gender?: Gender }) => void
  onUserInfo: (payload: unknown) => void
  onMatch: (payload: unknown) => void
  onErrorMessage: (message: string) => void
  onTyping: (typing: boolean) => void
  onPresenceCount: (onlineCount: number) => void
  onSocketClosed: (code: number, reason: string) => void
}

type SocketEnvelope = {
  type: PayloadType
  payload: unknown
}

type IncomingMessagePayload = {
  id: string
  name: string
  message: string
  gender?: Gender
}

type TypingPayload = {
  typing?: boolean
}

export const useChatSocket = ({
  sessionId,
  meId,
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
  onSocketClosed
}: UseChatSocketOptions) => {
  const hasConnectedRef = useRef(false)
  const [socketUrl, setSocketUrl] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!sessionId) {
      setSocketUrl(null)
      return () => {
        cancelled = true
      }
    }

    setSocketUrl(null)

    const resolveSocketUrl = async () => {
      const accessToken = await resolveStackAccessToken()
      if (cancelled) {
        return
      }

      setSocketUrl(getSocketUrl(WS_ENDPOINT, sessionId, accessToken))
    }

    void resolveSocketUrl()

    return () => {
      cancelled = true
    }
  }, [sessionId])

  const socket = useWebSocket(
    socketUrl,
    {
      shouldReconnect: (closeEvent) => !(closeEvent.code === 1008 && closeEvent.reason === 'CHAT_ACCESS_RESTRICTED'),
      onClose: (event) => {
        onSocketClosed(event.code, event.reason)
      },
      onMessage: (event) => {
        const data = JSON.parse(event.data) as SocketEnvelope

        switch (data.type) {
          case PayloadType.Disconnect:
            onDisconnect()
            onSystemMessage('system.strangerDisconnected')
            break
          case PayloadType.Message: {
            const payload = data.payload as IncomingMessagePayload
            onIncomingMessage({
              id: payload.id,
              name: payload.name,
              message: payload.message,
              gender: payload.gender
            })
            break
          }
          case PayloadType.UserInfo: {
            const user = toUser(data.payload as Partial<User>)
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
            const user = toUser(data.payload as Partial<User>)
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
            onTyping(Boolean((data.payload as TypingPayload).typing))
            break
          case PayloadType.PresenceCount:
            onPresenceCount((data.payload as PresenceCountPayload).online_count)
            break
        }
      }
    },
    Boolean(socketUrl)
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
    if (!socketUrl) {
      return 'connecting'
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
  }, [sessionId, socket.readyState, socketUrl])

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
    }
  }
}
