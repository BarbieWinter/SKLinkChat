import type { Gender } from '@/shared/types'

type InitialStateOptions = {
  displayName: string
  keywords: string[]
  gender: Gender
  meName?: string
  generateUsername: () => string
}

export const getSettingsDialogInitialState = ({
  displayName,
  keywords,
  gender,
  meName,
  generateUsername
}: InitialStateOptions) => ({
  name: displayName || meName || generateUsername(),
  keywords: keywords.join(', '),
  gender
})
