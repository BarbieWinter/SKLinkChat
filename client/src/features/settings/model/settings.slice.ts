/**
 * Local settings slice.
 */
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface SettingsState {
  displayName: string
  keywords: string[]
  setDisplayName: (name: string) => void
  saveSettings: (keywords: string[]) => void
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsState> = (set) => ({
  displayName: '',
  keywords: [],
  setDisplayName: (displayName: string) => set({ displayName }),
  saveSettings: (keywords: string[]) => set({ keywords })
})
