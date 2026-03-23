/**
 * Chat message slice.
 */
import { Message } from '@/shared/types'
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface ChatState {
  messages: Message[]
  addMessage: (message: Message) => void
  clear: () => void
}

export const createChatSlice: StateCreator<AppState, [], [], ChatState> = (set) => ({
  messages: [],
  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),
  clear: () => set({ messages: [] })
})
