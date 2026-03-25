import { useAppStore } from '@/app/store'

describe('settings store behavior', () => {
  beforeEach(() => {
    sessionStorage.clear()
    useAppStore.setState({
      ...useAppStore.getState(),
      displayName: '',
      keywords: []
    })
  })

  it('saves profile settings into the app store', () => {
    useAppStore.getState().setDisplayName('Plan User')
    useAppStore.getState().saveSettings(['music', 'movies'])

    expect(useAppStore.getState().displayName).toBe('Plan User')
    expect(useAppStore.getState().keywords).toEqual(['music', 'movies'])
  })
})
