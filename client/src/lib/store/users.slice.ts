/**
 * 用户状态切片：维护“我”和“陌生人”的资料，以及对方输入状态和断开逻辑。
 */
import { User } from '@/types'
import { StateCreator } from 'zustand'
import type { State } from '.'

export interface UsersState {
  me: User | undefined
  stranger: User | undefined

  setMe: (user: User) => void
  setStranger: (user: User) => void
  setStrangerTyping: (typing: boolean) => void
  setName: (name: string) => void
  disconnect: () => void
}

export const createUsersSlice: StateCreator<State, [], [], UsersState> = (set) => ({
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
    })
})
