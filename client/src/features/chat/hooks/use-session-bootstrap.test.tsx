import { renderHook, waitFor } from '@testing-library/react'

import { useSessionBootstrap } from '@/features/chat/hooks/use-session-bootstrap'

describe('useSessionBootstrap', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.restoreAllMocks()
  })

  it('creates a new session when none is stored', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ session_id: 'session-123' })
      })
    )

    const { result } = renderHook(() =>
      useSessionBootstrap({
        onError: vi.fn()
      })
    )

    await waitFor(() => {
      expect(result.current).toBe('session-123')
    })

    expect(sessionStorage.getItem('sklinkchat-session-id')).toBe('session-123')
  })
})
