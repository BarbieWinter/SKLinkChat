type InitialStateOptions = {
  displayName: string
  keywords: string[]
  meName?: string
  generateUsername: () => string
}

export const getSettingsDialogInitialState = ({
  displayName,
  keywords,
  meName,
  generateUsername
}: InitialStateOptions) => ({
  name: displayName || meName || generateUsername(),
  keywords: keywords.join(', ')
})
