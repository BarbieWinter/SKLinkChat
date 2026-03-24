/**
 * 聊天 Provider：封装 WebSocket 连接、服务端消息分发、发送消息、开始匹配、修改昵称与输入状态同步。
 */
import { useToast } from '@/components/ui/use-toast'
import { useI18n } from '@/hooks/useI18n'
import { WS_ENDPOINT } from '@/lib/config'
import { useStore } from '@/lib/store'
import { PayloadType, User, UserState } from '@/types'
import React, { createContext, useContext, useEffect, useMemo } from 'react'
import useWebSocket from 'react-use-websocket'

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

const SESSION_STORAGE_KEY = 'sklinkchat-session-id'

const getOrCreateSessionId = () => {
  if (typeof window === 'undefined') return ''

  const existingSessionId = window.sessionStorage.getItem(SESSION_STORAGE_KEY)
  if (existingSessionId) return existingSessionId

  const nextSessionId = crypto.randomUUID()
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, nextSessionId)
  return nextSessionId
}

const getSocketUrl = () => {
  const sessionId = getOrCreateSessionId()
  if (!sessionId) return WS_ENDPOINT

  const url = new URL(WS_ENDPOINT)
  url.searchParams.set('sessionId', sessionId)
  return url.toString()
}

const toUser = (user: Partial<User> | undefined): User | undefined => {
  // 把后端返回的部分用户结构收敛为前端界面需要的完整结构。
  if (!user?.id || !user?.name || !user?.state) return undefined

  return {
    id: user.id,
    name: user.name,
    state: user.state,
    isTyping: user.isTyping ?? false
  }
}

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const { toast } = useToast()
  const { t } = useI18n()
  const { addMessage, clear, setMe, setStranger, setStrangerTyping, me, stranger, disconnect, setName, displayName } =
    useStore()

  const onMessage = (event: MessageEvent) => {
    // 统一处理服务端推送的所有协议消息，并同步到本地 store/UI。
    const data = JSON.parse(event.data)

    switch (data.type) {
      case PayloadType.Disconnect:
        disconnect()
        addMessage({
          sender: 'system',
          message: t('system.strangerDisconnected')
        })
        break
      case PayloadType.Message:
        addMessage({
          sender: data.payload.name,
          message: data.payload.message
        })
        break
      case PayloadType.UserInfo: {
        const user = toUser(data.payload)
        if (user) {
          setMe(user)
          if (user.state !== UserState.Connected) {
            disconnect()
          }
        }
        break
      }
      case PayloadType.Match: {
        const user = toUser(data.payload)
        if (user) setStranger(user)
        break
      }
      case PayloadType.Error:
        if (data.payload === 'Client not found') {
          disconnect()
          addMessage({
            sender: 'system',
            message: t('system.strangerDisconnected')
          })
          break
        }

        toast({
          title: t('common.error'),
          description: data.payload,
          variant: 'destructive'
        })
        break
      case PayloadType.Typing:
        setStrangerTyping(Boolean(data.payload.typing))
        break
    }
  }

  const ws = useWebSocket(getSocketUrl(), {
    shouldReconnect: () => true,
    onOpen: () => {
      console.info('Connected to websocket server.', me?.id)
    },
    onMessage
  })

  useEffect(() => {
    if (!me?.id || !displayName || me.name === displayName) return

    setName(displayName)
    ws.sendJsonMessage({
      id: me.id,
      type: PayloadType.UserInfo,
      payload: { name: displayName }
    })
  }, [displayName, me?.id, me?.name, setName, ws])

  const value = useMemo<ChatProviderState>(
    () => ({
      emitTyping: (typing: boolean) => {
        // 告知后端当前用户是否正在输入，后端会转发给当前聊天对象。
        if (!stranger?.id) return

        ws.sendJsonMessage({
          type: PayloadType.Typing,
          payload: {
            id: stranger.id,
            typing
          }
        })
      },
      sendMessage: (message: string) => {
        // 发送消息后，前端也会先把“我”的消息写入本地消息列表，提升即时反馈体验。
        if (!stranger?.id) return

        ws.sendJsonMessage({
          type: PayloadType.Message,
          payload: {
            id: stranger.id,
            name: stranger.name ?? stranger.id,
            message
          }
        })
        addMessage({
          sender: 'me',
          message
        })
      },
      connect: () => {
        // 开始匹配前先清空当前聊天记录，再把自己放入服务端队列。
        if (!me?.id) return

        clear()
        ws.sendJsonMessage({
          payload: {
            id: me.id
          },
          type: PayloadType.Queue
        })
      },
      setName: (name: string) => {
        // 修改昵称时通过协议通知服务端同步用户信息。
        ws.sendJsonMessage({
          id: me?.id,
          type: PayloadType.UserInfo,
          payload: { name }
        })
      },
      stranger,
      me
    }),
    [addMessage, clear, me, stranger, ws]
  )

  return <ChatProviderContext.Provider value={value}>{children}</ChatProviderContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatProviderContext)
  if (context === undefined) throw new Error('useChat must be used within a ChatProvider')
  return context
}
