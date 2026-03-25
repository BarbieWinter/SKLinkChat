/**
 * 国际化 Hook：从全局设置中读取当前语言，并返回翻译函数和用户状态格式化函数。
 */
import { getDefaultLanguage, getUserStateLabel, translate } from '@/lib/i18n'
import { UserState } from '@/types'

export const useI18n = () => {
  const language = getDefaultLanguage()

  return {
    language,
    t: (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    formatUserState: (state?: UserState) => getUserStateLabel(language, state)
  }
}
