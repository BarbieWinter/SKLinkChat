import { getUserStateLabel, translate } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { UserState } from '@/types'

export const useI18n = () => {
  const language = useStore((state) => state.language)

  return {
    language,
    t: (key: Parameters<typeof translate>[1], values?: Record<string, string | number>) =>
      translate(language, key, values),
    formatUserState: (state?: UserState) => getUserStateLabel(language, state)
  }
}
