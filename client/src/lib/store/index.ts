/**
 * Zustand 总状态入口：把聊天、用户、设置三个切片合并，并启用 sessionStorage 持久化。
 */
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'
import { ChatState, createChatSlice } from './chat.slice'
import { SettingsState, createSettingsSlice } from './settings.slice'
import { UsersState, createUsersSlice } from './users.slice'

export type State = ChatState & SettingsState & UsersState

export const useStore = create<State>()(
  devtools(
    persist<State>(
      (...a) => ({
        // 使用切片模式拆分状态，避免所有业务都堆在一个大 store 中。
        ...createChatSlice(...a),
        ...createSettingsSlice(...a),
        ...createUsersSlice(...a)
      }),
      {
        name: 'msn-storage',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          displayName: state.displayName,
          messages: state.messages,
          keywords: state.keywords,
          language: state.language
        }) as State
      }
    )
  )
)
