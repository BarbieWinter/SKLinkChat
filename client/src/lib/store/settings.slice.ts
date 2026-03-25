/**
 * 设置状态切片：保存展示名和兴趣等本地配置。
 */
import { StateCreator } from 'zustand'
import type { State } from '.'

export interface SettingsState {
  displayName: string
  keywords: string[]
  setDisplayName: (name: string) => void
  saveSettings: (keywords: string[]) => void
}

export const createSettingsSlice: StateCreator<State, [], [], SettingsState> = (set) => ({
  displayName: '',
  keywords: [],
  setDisplayName: (displayName: string) => set({ displayName }),
  saveSettings: (keywords: string[]) => set({ keywords })
})
