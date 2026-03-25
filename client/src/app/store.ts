/**
 * App store composition: feature slices are composed at the app boundary.
 */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

import { ChatState, createChatSlice } from '@/features/chat/model/chat.slice'
import { SessionState, createSessionSlice } from '@/features/chat/model/session.slice'
import { SettingsState, createSettingsSlice } from '@/features/settings/model/settings.slice'

export type AppState = ChatState & SettingsState & SessionState

export const useAppStore = create<AppState>()(
  devtools((...a) => ({
    ...createChatSlice(...a),
    ...createSettingsSlice(...a),
    ...createSessionSlice(...a)
  }))
)
