import { useEffect } from 'react'

import useWebSocket from 'react-use-websocket'

import { getSocketUrl, toUser } from '@/features/chat/services/protocol'
import { WS_ENDPOINT } from '@/shared/config/runtime'
import { PayloadType, UserState } from '@/shared/types'

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
  syncDisplayName
}: UseChatSocketOptions) => {
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
            if (user.state !== UserState.Connected) {
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
            if (data.payload === 'Client not found' || data.payload === 'Client temporarily unavailable') {
              onDisconnect()
              onSystemMessage('system.strangerDisconnected')
              break
            }

            onErrorMessage(String(data.payload))
            break
          case PayloadType.Typing:
            onTyping(Boolean(data.payload.typing))
            break
        }
      }
    },
    Boolean(sessionId)
  )

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
          message
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
