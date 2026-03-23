/**
 * App store composition: feature slices are composed at the app boundary and persisted in sessionStorage.
 */
import { create } from 'zustand'
import { createJSONStorage, devtools, persist } from 'zustand/middleware'

import { ChatState, createChatSlice } from '@/features/chat/model/chat.slice'
import { SessionState, createSessionSlice } from '@/features/chat/model/session.slice'
import { SettingsState, createSettingsSlice } from '@/features/settings/model/settings.slice'

export type AppState = ChatState & SettingsState & SessionState

export const useAppStore = create<AppState>()(
  devtools(
    persist<AppState>(
      (...a) => ({
        ...createChatSlice(...a),
        ...createSettingsSlice(...a),
        ...createSessionSlice(...a)
      }),
      {
        name: 'sklinkchat-storage',
        storage: createJSONStorage(() => sessionStorage),
        partialize: (state) => ({
          displayName: state.displayName,
          messages: state.messages,
          keywords: state.keywords,
          language: state.language
        }) as AppState
      }
    )
  )
)
