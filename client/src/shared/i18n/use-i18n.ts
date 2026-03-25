/**
 * I18n hook backed by the app store.
 */
import { UserState } from '@/shared/types'

import { getDefaultLanguage, getUserStateLabel, translate } from '@/shared/i18n'

export const useI18n = () => {
  const language = getDefaultLanguage()

  return {
    language,
    t: (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    formatUserState: (state?: UserState) => getUserStateLabel(language, state)
  }
}
