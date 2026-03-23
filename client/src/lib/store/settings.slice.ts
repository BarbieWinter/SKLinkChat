/**
 * 设置状态切片：保存话题偏好和界面语言等本地配置。
 */
import { AppLanguage, getDefaultLanguage } from '@/lib/i18n'
import { StateCreator } from 'zustand'
import type { State } from '.'

export interface SettingsState {
  displayName: string
  keywords: string[]
  language: AppLanguage
  setDisplayName: (name: string) => void
  saveSettings: (keywords: string[]) => void
  setLanguage: (language: AppLanguage) => void
}

export const createSettingsSlice: StateCreator<State, [], [], SettingsState> = (set) => ({
  displayName: '',
  keywords: [],
  language: getDefaultLanguage(),
  setDisplayName: (displayName: string) => set({ displayName }),
  saveSettings: (keywords: string[]) => set({ keywords }),
  setLanguage: (language: AppLanguage) => set({ language })
})
