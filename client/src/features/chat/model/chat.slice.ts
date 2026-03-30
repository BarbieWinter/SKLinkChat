/**
 * Chat message slice.
 */
import { Message } from '@/shared/types'
import { prepareBubble } from '@/shared/lib/pretext'
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface ChatState {
  messages: Message[]
  addMessage: (message: Message) => void
  clear: () => void
}

export const createChatSlice: StateCreator<AppState, [], [], ChatState> = (set) => ({
  messages: [],
  addMessage: (message) => {
    // Pre-compute text layout handle for non-system messages
    if (message.sender !== 'system' && !message._prepared) {
      try {
        message._prepared = prepareBubble(message.message)
      } catch {
        // pretext requires canvas which is unavailable in test environments
      }
    }
    set((state) => ({ messages: [...state.messages, message] }))
  },
  clear: () => set({ messages: [] })
})
