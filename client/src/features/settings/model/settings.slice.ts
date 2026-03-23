/**
 * Local settings slice.
 */
import { AppLanguage, getDefaultLanguage } from '@/shared/i18n'
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface SettingsState {
  displayName: string
  keywords: string[]
  language: AppLanguage
  setDisplayName: (name: string) => void
  saveSettings: (keywords: string[]) => void
  setLanguage: (language: AppLanguage) => void
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsState> = (set) => ({
  displayName: '',
  keywords: [],
  language: getDefaultLanguage(),
  setDisplayName: (displayName: string) => set({ displayName }),
  saveSettings: (keywords: string[]) => set({ keywords }),
  setLanguage: (language: AppLanguage) => set({ language })
})
