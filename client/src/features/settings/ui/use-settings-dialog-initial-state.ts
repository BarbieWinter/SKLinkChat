import { AppLanguage } from '@/shared/i18n'

type InitialStateOptions = {
  displayName: string
  keywords: string[]
  language: AppLanguage
  meName?: string
  generateUsername: () => string
}

export const getSettingsDialogInitialState = ({
  displayName,
  keywords,
  language,
  meName,
  generateUsername
}: InitialStateOptions) => ({
  name: displayName || meName || generateUsername(),
  keywords: keywords.join(', '),
  language
})
