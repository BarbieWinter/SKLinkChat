import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import ChatReportDialog from '@/features/chat/ui/chat-report-dialog'

const toast = vi.fn()

vi.mock('@/shared/ui/use-toast', () => ({
  useToast: () => ({ toast })
}))

describe('ChatReportDialog', () => {
  beforeEach(() => {
    toast.mockReset()
    vi.restoreAllMocks()
  })

  it('requires details when reason is other and submits the expected payload', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ status: 'accepted', report_id: 1 })
      })

    vi.stubGlobal('fetch', fetchMock)

    render(<ChatReportDialog sessionId="session-1" reportedSessionId="session-2" partnerName="Alex" />)

    fireEvent.click(screen.getByRole('button', { name: '举报' }))
    fireEvent.click(screen.getByRole('button', { name: '其他' }))
    fireEvent.click(screen.getByRole('button', { name: '提交举报' }))

    expect(fetchMock).not.toHaveBeenCalled()

    fireEvent.change(screen.getByPlaceholderText('请填写详细说明（必填）'), {
      target: { value: '补充上下文' }
    })
    fireEvent.click(screen.getByRole('button', { name: '提交举报' }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledTimes(1)
    })

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining('/api/chat/reports'),
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          session_id: 'session-1',
          reported_session_id: 'session-2',
          reason: 'other',
          details: '补充上下文'
        })
      })
    )
  })
})
