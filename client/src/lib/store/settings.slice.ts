import { AppLanguage, getDefaultLanguage } from '@/lib/i18n'
import { StateCreator } from 'zustand'
import type { State } from '.'

export interface SettingsState {
  keywords: string[]
  language: AppLanguage
  saveSettings: (keywords: string[]) => void
  setLanguage: (language: AppLanguage) => void
}

export const createSettingsSlice: StateCreator<State, [], [], SettingsState> = (set) => ({
  keywords: [],
  language: getDefaultLanguage(),
  saveSettings: (keywords: string[]) => set({ keywords }),
  setLanguage: (language: AppLanguage) => set({ language })
})
