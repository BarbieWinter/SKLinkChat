import { API_BASE_URL } from '@/shared/config/runtime'
import { resolveAuthHeaders } from '@/shared/lib/auth-headers'

export type AdminReportStatus = 'open' | 'reviewed' | 'dismissed' | 'actioned'
export type AdminReportReason = 'harassment' | 'sexual_content' | 'spam' | 'hate_speech' | 'other'

export type AdminReportListItem = {
  id: number
  created_at: string
  reason: AdminReportReason
  status: AdminReportStatus
  reporter_display_name: string
  reporter_short_id: string | null
  reporter_email_masked: string | null
  reported_display_name: string
  reported_short_id: string | null
  reported_email_masked: string | null
  reported_account_chat_access_restricted: boolean
  reported_account_chat_access_restriction_report_id: number | null
}

export type AdminReportDetail = {
  id: number
  reason: AdminReportReason
  details: string | null
  status: AdminReportStatus
  created_at: string
  reviewed_at: string | null
  review_note: string | null
  chat_match_id: string
  reported_chat_session_id: string
  reporter_account_id: string
  reporter_display_name: string
  reporter_short_id: string | null
  reporter_email: string | null
  reported_account_id: string
  reported_display_name: string
  reported_short_id: string | null
  reported_email: string | null
  reported_account_chat_access_restricted: boolean
  reported_account_chat_access_restricted_at: string | null
  reported_account_chat_access_restriction_reason: string | null
  reported_account_chat_access_restriction_report_id: number | null
  reported_account_chat_access_restriction_report_status: string | null
  governance_triggered_by_this_report: boolean
  reviewer_account_id: string | null
  reviewer_display_name: string | null
  reviewer_email: string | null
}

export type AdminRestrictedAccountItem = {
  account_id: string
  display_name: string
  short_id: string | null
  email_masked: string | null
  chat_access_restricted: boolean
  restricted_at: string
  restriction_reason: string
  source_report_id: number | null
  source_report_status: string | null
  source_report_reason: AdminReportReason | null
  source_report_created_at: string | null
}

export type AdminAuditEvent = {
  id: string
  event_type: string
  account_id: string | null
  account_display_name: string | null
  account_short_id: string | null
  account_email_masked: string | null
  chat_session_id: string | null
  payload: Record<string, unknown>
  created_at: string
}

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const authHeaders = await resolveAuthHeaders(init?.headers)

  const response = await fetch(`${API_BASE_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    ...init
  })

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as {
      code?: string
      message?: string
    } | null

    const error = new Error(payload?.message ?? `Request failed: ${response.status}`) as Error & {
      code?: string
      status?: number
    }
    error.code = payload?.code
    error.status = response.status
    throw error
  }

  return (await response.json()) as T
}

type ListReportsParams = {
  status?: string
  reason?: string
  limit?: number
  offset?: number
}

type ListAuditEventsParams = {
  event_type?: string
  account_id?: string
  chat_session_id?: string
  limit?: number
  offset?: number
}

const toQueryString = (params: Record<string, string | number | undefined>) => {
  const searchParams = new URLSearchParams()

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === '') {
      return
    }
    searchParams.set(key, String(value))
  })

  const query = searchParams.toString()
  return query ? `?${query}` : ''
}

export const listReports = async (params: ListReportsParams = {}) =>
  requestJson<{ items: AdminReportListItem[] }>(
    `/api/admin/reports${toQueryString({
      status: params.status,
      reason: params.reason,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0
    })}`,
    { method: 'GET' }
  )

export const getReportDetail = (reportId: number) =>
  requestJson<AdminReportDetail>(`/api/admin/reports/${reportId}`, { method: 'GET' })

export const reviewReport = (
  reportId: number,
  payload: { status: Exclude<AdminReportStatus, 'open'>; review_note: string }
) =>
  requestJson<AdminReportDetail>(`/api/admin/reports/${reportId}/review`, {
    method: 'POST',
    body: JSON.stringify(payload)
  })

export const listRestrictedAccounts = async (params: { limit?: number; offset?: number } = {}) =>
  requestJson<{ items: AdminRestrictedAccountItem[] }>(
    `/api/admin/restricted-accounts${toQueryString({
      limit: params.limit ?? 20,
      offset: params.offset ?? 0
    })}`,
    { method: 'GET' }
  )

export const listAuditEvents = async (params: ListAuditEventsParams = {}) =>
  requestJson<{ items: AdminAuditEvent[] }>(
    `/api/admin/audit-events${toQueryString({
      event_type: params.event_type,
      account_id: params.account_id,
      chat_session_id: params.chat_session_id,
      limit: params.limit ?? 20,
      offset: params.offset ?? 0
    })}`,
    { method: 'GET' }
  )

export const restrictAccountFromReport = (accountId: string, reason: string, sourceReportId: number) =>
  requestJson<{ account_id: string; chat_access_restricted: boolean }>(`/api/admin/accounts/${accountId}/restrict`, {
    method: 'POST',
    body: JSON.stringify({ reason, source_report_id: sourceReportId })
  })

export const restoreAccount = (accountId: string, reason: string) =>
  requestJson<{ account_id: string; chat_access_restricted: boolean }>(`/api/admin/accounts/${accountId}/restore`, {
    method: 'POST',
    body: JSON.stringify({ reason })
  })
