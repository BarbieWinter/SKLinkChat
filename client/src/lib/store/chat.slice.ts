/**
 * 聊天状态切片：只负责消息列表的存取与清空。
 */
import { Message } from '@/types'
import { StateCreator } from 'zustand'
import type { State } from '.'

export interface ChatState {
  messages: Message[]
  addMessage: (message: Message) => void
  clear: () => void
}

export const createChatSlice: StateCreator<State, [], [], ChatState> = (set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clear: () => set({ messages: [] })
})
