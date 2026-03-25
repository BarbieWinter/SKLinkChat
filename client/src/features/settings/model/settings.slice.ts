/**
 * Local settings slice.
 */
import { AppLanguage } from '@/shared/i18n'
import { StateCreator } from 'zustand'

import type { AppState } from '@/app/store'

export interface SettingsState {
  displayName: string
  keywords: string[]
  language: AppLanguage
  setDisplayName: (name: string) => void
  saveSettings: (keywords: string[]) => void
}

export const createSettingsSlice: StateCreator<AppState, [], [], SettingsState> = (set) => ({
  displayName: '',
  keywords: [],
  language: 'zh-CN',
  setDisplayName: (displayName: string) => set({ displayName }),
  saveSettings: (keywords: string[]) => set({ keywords })
})
