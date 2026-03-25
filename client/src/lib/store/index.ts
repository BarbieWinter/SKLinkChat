/**
 * Zustand 总状态入口：把聊天、用户、设置三个切片合并。
 */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { ChatState, createChatSlice } from './chat.slice'
import { SettingsState, createSettingsSlice } from './settings.slice'
import { UsersState, createUsersSlice } from './users.slice'

export type State = ChatState & SettingsState & UsersState

export const useStore = create<State>()(
  devtools((...a) => ({
    ...createChatSlice(...a),
    ...createSettingsSlice(...a),
    ...createUsersSlice(...a)
  }))
)
