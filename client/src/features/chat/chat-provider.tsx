/**
 * Thin chat provider that delegates chat runtime orchestration to feature hooks.
 */
import React, { createContext, useContext } from 'react'

import { ChatProviderState, useChatRuntime } from '@/features/chat/hooks/use-chat-runtime'

type ChatProviderProps = {
  children: React.ReactNode
}

const initialState: ChatProviderState = {
  sendMessage: undefined,
  connect: undefined,
  stranger: undefined,
  me: undefined,
  sessionId: '',
  emitTyping: undefined,
  bootstrapStatus: 'bootstrapping',
  transportStatus: 'idle',
  availability: 'disabled',
  retryBootstrap: undefined
}

const ChatProviderContext = createContext<ChatProviderState>(initialState)

export const ChatProvider = ({ children }: ChatProviderProps) => {
  const value = useChatRuntime()

  return <ChatProviderContext.Provider value={value}>{children}</ChatProviderContext.Provider>
}

export const useChat = () => {
  const context = useContext(ChatProviderContext)
  if (context === undefined) throw new Error('useChat must be used within a ChatProvider')
  return context
}
