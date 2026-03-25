import { act, renderHook, waitFor } from '@testing-library/react'

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
      expect(result.current.sessionId).toBe('session-123')
    })

    expect(sessionStorage.getItem('sklinkchat-session-id')).toBe('session-123')
    expect(result.current.status).toBe('ready')
  })

  it('supports retrying after a bootstrap failure', async () => {
    const onError = vi.fn()
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ session_id: 'session-456' })
      })

    vi.stubGlobal('fetch', fetchMock)

    const { result } = renderHook(() =>
      useSessionBootstrap({
        onError
      })
    )

    await waitFor(() => {
      expect(result.current.status).toBe('error')
    })

    expect(onError).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.retry()
    })

    await waitFor(() => {
      expect(result.current.sessionId).toBe('session-456')
    })

    expect(result.current.status).toBe('ready')
  })
})
