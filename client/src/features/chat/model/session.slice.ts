/**
 * Chat session slice: owns me/stranger state.
 */
import { User } from '@/shared/types'
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface SessionState {
  me: User | undefined
  stranger: User | undefined

  setMe: (user: User) => void
  setStranger: (user: User) => void
  setStrangerTyping: (typing: boolean) => void
  setName: (name: string) => void
  disconnect: () => void
  resetSession: () => void
  clearChatConnection: () => void
}

export const createSessionSlice: StateCreator<AppState, [], [], SessionState> = (set) => ({
  me: undefined,
  stranger: undefined,
  setMe: (user: User) =>
    set({
      me: user
    }),
  setStranger: (user: User) => set({ stranger: user }),
  setStrangerTyping: (typing: boolean) =>
    set((state) => ({
      stranger: state.stranger
        ? {
            ...state.stranger,
            isTyping: typing
          }
        : undefined
    })),
  setName: (name: string) => set((state) => ({ me: { ...(state.me as User), name } })),
  disconnect: () =>
    set({
      stranger: undefined
    }),
  clearChatConnection: () =>
    set({
      stranger: undefined,
      messages: []
    }),
  resetSession: () =>
    set({
      me: undefined,
      stranger: undefined
    })
})
