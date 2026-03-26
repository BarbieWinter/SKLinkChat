import { fireEvent, render, screen, waitFor } from '@testing-library/react'

import { AdminReportsPage } from '@/features/admin/ui/admin-reports-page'

const refreshSession = vi.fn().mockResolvedValue(undefined)
const listReports = vi.fn()
const getReportDetail = vi.fn()
const listRestrictedAccounts = vi.fn()
const reviewReport = vi.fn()
const restrictAccountFromReport = vi.fn()
const restoreAccount = vi.fn()

vi.mock('@/features/admin/api/admin-client', () => ({
  listReports: (...args: unknown[]) => listReports(...args),
  getReportDetail: (...args: unknown[]) => getReportDetail(...args),
  listRestrictedAccounts: (...args: unknown[]) => listRestrictedAccounts(...args),
  reviewReport: (...args: unknown[]) => reviewReport(...args),
  restrictAccountFromReport: (...args: unknown[]) => restrictAccountFromReport(...args),
  restoreAccount: (...args: unknown[]) => restoreAccount(...args)
}))

vi.mock('@/features/auth/auth-provider', () => ({
  useAuth: () => ({
    refreshSession
  })
}))

const baseListItem = {
  id: 7,
  created_at: '2026-03-26T10:00:00Z',
  reason: 'harassment',
  status: 'open',
  reporter_display_name: 'Reporter',
  reporter_short_id: '112233',
  reporter_email_masked: 're***@example.com',
  reported_display_name: 'Target',
  reported_short_id: '445566',
  reported_email_masked: 'ta***@example.com',
  reported_account_chat_access_restricted: false,
  reported_account_chat_access_restriction_report_id: null
} as const

const baseDetail = {
  id: 7,
  reason: 'harassment',
  details: '辱骂内容',
  status: 'open',
  created_at: '2026-03-26T10:00:00Z',
  reviewed_at: null,
  review_note: null,
  chat_match_id: 'match-1',
  reported_chat_session_id: 'session-2',
  reporter_account_id: 'account-1',
  reporter_display_name: 'Reporter',
  reporter_short_id: '112233',
  reporter_email: 'reporter@example.com',
  reported_account_id: 'account-2',
  reported_display_name: 'Target',
  reported_short_id: '445566',
  reported_email: 'target@example.com',
  reported_account_chat_access_restricted: false,
  reported_account_chat_access_restricted_at: null,
  reported_account_chat_access_restriction_reason: null,
  reported_account_chat_access_restriction_report_id: null,
  reported_account_chat_access_restriction_report_status: null,
  governance_triggered_by_this_report: false,
  reviewer_account_id: null,
  reviewer_display_name: null,
  reviewer_email: null
} as const

describe('AdminReportsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    refreshSession.mockResolvedValue(undefined)
    listReports.mockResolvedValue({ items: [baseListItem] })
    listRestrictedAccounts.mockResolvedValue({ items: [] })
    getReportDetail.mockResolvedValue(baseDetail)
    reviewReport.mockResolvedValue({
      ...baseDetail,
      status: 'actioned',
      review_note: '已处理'
    })
    restrictAccountFromReport.mockResolvedValue({
      account_id: 'account-2',
      chat_access_restricted: true
    })
    restoreAccount.mockResolvedValue({
      account_id: 'account-2',
      chat_access_restricted: false
    })
  })

  it('loads reports and submits a review action', async () => {
    render(<AdminReportsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-report-row-7')).toBeInTheDocument()
    })

    await waitFor(() => {
      expect(screen.getByTestId('admin-report-detail')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('admin-review-note'), {
      target: { value: '需要封禁聊天访问' }
    })
    fireEvent.click(screen.getByTestId('admin-review-submit'))

    await waitFor(() => {
      expect(reviewReport).toHaveBeenCalledWith(7, {
        status: 'reviewed',
        review_note: '需要封禁聊天访问'
      })
    })
  })

  it('submits a restrict action and reloads governance state', async () => {
    listRestrictedAccounts.mockResolvedValue({
      items: [
        {
          account_id: 'account-2',
          display_name: 'Target',
          short_id: '445566',
          email_masked: 'ta***@example.com',
          chat_access_restricted: true,
          restricted_at: '2026-03-26T11:00:00Z',
          restriction_reason: '重复恶意骚扰',
          source_report_id: 7,
          source_report_status: 'actioned',
          source_report_reason: 'harassment',
          source_report_created_at: '2026-03-26T10:00:00Z'
        }
      ]
    })

    render(<AdminReportsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('admin-report-detail')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByTestId('admin-account-action-reason'), {
      target: { value: '重复恶意骚扰' }
    })
    fireEvent.click(screen.getByTestId('admin-restrict-account'))

    await waitFor(() => {
      expect(restrictAccountFromReport).toHaveBeenCalledWith('account-2', '重复恶意骚扰', 7)
    })
  })

  it('shows restricted accounts and restores access from the governance list', async () => {
    listRestrictedAccounts.mockResolvedValue({
      items: [
        {
          account_id: 'account-2',
          display_name: 'Target',
          short_id: '445566',
          email_masked: 'ta***@example.com',
          chat_access_restricted: true,
          restricted_at: '2026-03-26T11:00:00Z',
          restriction_reason: '重复恶意骚扰',
          source_report_id: 7,
          source_report_status: 'actioned',
          source_report_reason: 'harassment',
          source_report_created_at: '2026-03-26T10:00:00Z'
        }
      ]
    })

    render(<AdminReportsPage />)

    await waitFor(() => {
      expect(screen.getByTestId('restricted-account-row-account-2')).toBeInTheDocument()
    })

    fireEvent.change(screen.getByPlaceholderText('填写恢复聊天访问原因'), {
      target: { value: '申诉通过' }
    })
    fireEvent.click(screen.getByTestId('restore-restricted-account-account-2'))

    await waitFor(() => {
      expect(restoreAccount).toHaveBeenCalledWith('account-2', '申诉通过')
    })
  })

  it('refreshes admin session and retries when the first report request returns admin forbidden', async () => {
    const forbiddenError = Object.assign(new Error('Admin access is required'), {
      code: 'ADMIN_FORBIDDEN',
      status: 403
    })
    listReports.mockRejectedValueOnce(forbiddenError).mockResolvedValueOnce({ items: [baseListItem] })

    render(<AdminReportsPage />)

    await waitFor(() => {
      expect(refreshSession).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect(screen.getByTestId('admin-report-row-7')).toBeInTheDocument()
    })
  })
})
