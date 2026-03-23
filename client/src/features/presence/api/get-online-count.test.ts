import { getOnlineCount } from '@/features/presence/api/get-online-count'

describe('getOnlineCount', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reads the active online count payload', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ online_count: 9 })
      })
    )

    await expect(getOnlineCount()).resolves.toBe(9)
  })
})
