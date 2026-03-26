import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AdminAuditPage } from '@/features/admin/ui/admin-audit-page'

const refreshSession = vi.fn().mockResolvedValue(undefined)
const listAuditEvents = vi.fn()

vi.mock('@/features/admin/api/admin-client', () => ({
  listAuditEvents: (...args: unknown[]) => listAuditEvents(...args)
}))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    refreshSession
  })
}))

describe('AdminAuditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshSession.mockResolvedValue(undefined)
    listAuditEvents.mockResolvedValue({
      items: [
        {
          id: 'event-1',
          event_type: 'admin.report.reviewed',
          account_id: 'account-2',
          account_display_name: 'Target',
          account_short_id: '445566',
          account_email_masked: 'ta***@example.com',
          chat_session_id: 'session-2',
          payload: { report_id: 7, status: 'actioned' },
          created_at: '2026-03-26T10:30:00Z'
        }
      ]
    })
  })

  it('renders audit items and reapplies filters', async () => {
    render(<AdminAuditPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-audit-row-0')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('admin.report.reviewed'), {
      target: { value: 'admin.account.chat_restricted' }
    })
    fireEvent.click(screen.getByRole('button', { name: '应用筛选' }))

    await waitFor(() => {
      expect(listAuditEvents).toHaveBeenLastCalledWith(
        expect.objectContaining({
          event_type: 'admin.account.chat_restricted'
        })
      )
    })
  })
})
