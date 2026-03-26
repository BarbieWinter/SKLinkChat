import { useEffect, useMemo, useState } from 'react'

import type {
  AdminReportDetail,
  AdminReportListItem,
  AdminReportReason,
  AdminReportStatus,
  AdminRestrictedAccountItem
} from '@/features/admin/api/admin-client'
import {
  getReportDetail,
  listReports,
  listRestrictedAccounts,
  restoreAccount,
  reviewReport,
  restrictAccountFromReport
} from '@/features/admin/api/admin-client'
import { useAuth } from '@/features/auth/auth-provider'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

const REPORT_STATUS_LABELS: Record<string, string> = {
  open: '待处理',
  reviewed: '已审核',
  dismissed: '已驳回',
  actioned: '已处置'
}

const REPORT_REASON_LABELS: Record<AdminReportReason, string> = {
  harassment: '骚扰/辱骂',
  sexual_content: '性相关不适内容',
  spam: '垃圾消息',
  hate_speech: '仇恨言论',
  other: '其他'
}

const STATUS_BADGE_CLASSNAMES: Record<string, string> = {
  open: 'border-amber-200 bg-amber-50 text-amber-700',
  reviewed: 'border-sky-200 bg-sky-50 text-sky-700',
  dismissed: 'border-slate-200 bg-slate-100 text-slate-700',
  actioned: 'border-emerald-200 bg-emerald-50 text-emerald-700'
}

const formatDateTime = (value: string | null) => {
  if (!value) {
    return '未发生'
  }

  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))
}

const StatusBadge = ({ status }: { status: string }) => (
  <Badge variant="outline" className={STATUS_BADGE_CLASSNAMES[status] ?? 'border-border bg-muted text-foreground'}>
    {REPORT_STATUS_LABELS[status] ?? status}
  </Badge>
)

const ReasonBadge = ({ reason }: { reason: AdminReportReason }) => (
  <Badge variant="outline" className="border-border/70 bg-muted/60 text-foreground">
    {REPORT_REASON_LABELS[reason]}
  </Badge>
)

const DetailRow = ({ label, value }: { label: string; value: string | null | undefined }) => (
  <div className="grid gap-1 rounded-2xl border border-border/60 bg-background/80 p-3">
    <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
    <span className="break-all text-sm text-foreground">{value && value.length > 0 ? value : '无'}</span>
  </div>
)

export const AdminReportsPage = () => {
  const { refreshSession } = useAuth()
  const [statusFilter, setStatusFilter] = useState<AdminReportStatus | ''>('open')
  const [reasonFilter, setReasonFilter] = useState<AdminReportReason | ''>('')
  const [reports, setReports] = useState<AdminReportListItem[]>([])
  const [restrictedAccounts, setRestrictedAccounts] = useState<AdminRestrictedAccountItem[]>([])
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null)
  const [reportDetail, setReportDetail] = useState<AdminReportDetail | null>(null)
  const [listLoading, setListLoading] = useState(true)
  const [restrictedLoading, setRestrictedLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [listError, setListError] = useState<string | null>(null)
  const [restrictedError, setRestrictedError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [reviewStatus, setReviewStatus] = useState<Exclude<AdminReportStatus, 'open'>>('reviewed')
  const [reviewNote, setReviewNote] = useState('')
  const [accountActionReason, setAccountActionReason] = useState('')
  const [restrictedRestoreReasons, setRestrictedRestoreReasons] = useState<Record<string, string>>({})
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null)
  const [submittingReview, setSubmittingReview] = useState(false)
  const [submittingAccountAction, setSubmittingAccountAction] = useState(false)
  const [restoringAccountId, setRestoringAccountId] = useState<string | null>(null)

  const runWithAdminRetry = async <T,>(task: () => Promise<T>) => {
    try {
      return await task()
    } catch (error) {
      const apiError = error as Error & { code?: string; status?: number }
      const shouldRetry =
        apiError.code === 'ADMIN_FORBIDDEN' ||
        apiError.code === 'UNAUTHENTICATED' ||
        apiError.status === 401 ||
        apiError.status === 403

      if (!shouldRetry) {
        throw error
      }

      await refreshSession()
      return await task()
    }
  }

  const loadReports = async (preferredReportId?: number | null) => {
    setListLoading(true)
    setListError(null)

    try {
      const response = await runWithAdminRetry(() =>
        listReports({
          status: statusFilter || undefined,
          reason: reasonFilter || undefined
        })
      )
      setReports(response.items)
      const nextSelectedReportId =
        preferredReportId && response.items.some((report) => report.id === preferredReportId)
          ? preferredReportId
          : response.items[0]?.id ?? null
      setSelectedReportId(nextSelectedReportId)
    } catch (error) {
      setListError(error instanceof Error ? error.message : '举报列表加载失败。')
      setReports([])
      setSelectedReportId(null)
    } finally {
      setListLoading(false)
    }
  }

  const loadRestrictedAccounts = async () => {
    setRestrictedLoading(true)
    setRestrictedError(null)

    try {
      const response = await runWithAdminRetry(() => listRestrictedAccounts())
      setRestrictedAccounts(response.items)
    } catch (error) {
      setRestrictedError(error instanceof Error ? error.message : '受限账号列表加载失败。')
      setRestrictedAccounts([])
    } finally {
      setRestrictedLoading(false)
    }
  }

  const loadReportDetail = async (reportId: number) => {
    setDetailLoading(true)
    setDetailError(null)

    try {
      const detail = await runWithAdminRetry(() => getReportDetail(reportId))
      setReportDetail(detail)
      setReviewNote(detail.review_note ?? '')
      setActionError(null)
      setActionSuccessMessage(null)
      setAccountActionReason(detail.reported_account_chat_access_restriction_reason ?? '')
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : '举报详情加载失败。')
      setReportDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }

  useEffect(() => {
    void loadReports(selectedReportId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, reasonFilter])

  useEffect(() => {
    void loadRestrictedAccounts()
  }, [])

  useEffect(() => {
    if (selectedReportId === null) {
      setReportDetail(null)
      return
    }

    void loadReportDetail(selectedReportId)
  }, [selectedReportId])

  const selectedReportSummary = useMemo(
    () => reports.find((report) => report.id === selectedReportId) ?? null,
    [reports, selectedReportId]
  )

  const submitReview = async () => {
    if (!reportDetail) {
      return
    }

    const normalizedNote = reviewNote.trim()
    if (!normalizedNote) {
      setActionError('审核备注不能为空。')
      return
    }

    setSubmittingReview(true)
    setActionError(null)
    setActionSuccessMessage(null)
    try {
      const detail = await runWithAdminRetry(() =>
        reviewReport(reportDetail.id, {
          status: reviewStatus,
          review_note: normalizedNote
        })
      )
      setReportDetail(detail)
      setActionSuccessMessage('举报状态已更新。')
      await loadReports(detail.id)
      await loadRestrictedAccounts()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '举报审核失败。')
    } finally {
      setSubmittingReview(false)
    }
  }

  const submitAccountAction = async (action: 'restrict' | 'restore') => {
    if (!reportDetail) {
      return
    }

    const normalizedReason = accountActionReason.trim()
    if (!normalizedReason) {
      setActionError('账号治理原因不能为空。')
      return
    }

    setSubmittingAccountAction(true)
    setActionError(null)
    setActionSuccessMessage(null)
    try {
      if (action === 'restrict') {
        await runWithAdminRetry(() =>
          restrictAccountFromReport(reportDetail.reported_account_id, normalizedReason, reportDetail.id)
        )
        setActionSuccessMessage('账号已限制聊天访问，治理结果已同步。')
      } else {
        await runWithAdminRetry(() => restoreAccount(reportDetail.reported_account_id, normalizedReason))
        setActionSuccessMessage('账号聊天访问已恢复，治理结果已同步。')
      }
      await loadReportDetail(reportDetail.id)
      await loadReports(reportDetail.id)
      await loadRestrictedAccounts()
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '账号治理操作失败。')
    } finally {
      setSubmittingAccountAction(false)
    }
  }

  const restoreRestrictedAccount = async (account: AdminRestrictedAccountItem) => {
    const normalizedReason = (restrictedRestoreReasons[account.account_id] ?? '').trim()
    if (!normalizedReason) {
      setActionError('恢复聊天访问时请填写原因。')
      return
    }

    setRestoringAccountId(account.account_id)
    setActionError(null)
    setActionSuccessMessage(null)
    try {
      await runWithAdminRetry(() => restoreAccount(account.account_id, normalizedReason))
      setActionSuccessMessage(`已恢复 ${account.display_name} 的聊天访问。`)
      await loadRestrictedAccounts()
      await loadReports(selectedReportId)
      if (reportDetail?.reported_account_id === account.account_id) {
        await loadReportDetail(reportDetail.id)
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '恢复聊天访问失败。')
    } finally {
      setRestoringAccountId(null)
    }
  }

  return (
    <section data-testid="admin-reports-page" className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">待处理举报</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">
            {reports.filter((report) => report.status === 'open').length}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">处理完成后，列表、详情和治理结果区域会一起刷新。</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">当前已限制聊天</p>
          <p className="mt-3 text-3xl font-semibold text-foreground">{restrictedAccounts.length}</p>
          <p className="mt-2 text-sm text-muted-foreground">无需再登录对方账号验证，后台直接回显当前限制名单。</p>
        </div>
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
          <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">当前查看</p>
          <p className="mt-3 text-xl font-semibold text-foreground">
            {reportDetail ? `举报 #${reportDetail.id}` : '未选择举报'}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {reportDetail ? `状态：${REPORT_STATUS_LABELS[reportDetail.status]}` : '请选择一条举报查看治理详情。'}
          </p>
        </div>
      </div>

      {actionSuccessMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {actionSuccessMessage}
        </div>
      ) : null}
      {actionError ? (
        <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-foreground">举报列表</h2>
              <p className="mt-1 text-sm text-muted-foreground">默认展示待处理举报，并强化治理状态、原因与限制回显。</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="grid gap-2 text-sm text-muted-foreground">
              状态
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as AdminReportStatus | '')}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="open">待处理</option>
                <option value="">全部</option>
                <option value="reviewed">已审核</option>
                <option value="dismissed">已驳回</option>
                <option value="actioned">已处置</option>
              </select>
            </label>

            <label className="grid gap-2 text-sm text-muted-foreground">
              原因
              <select
                value={reasonFilter}
                onChange={(event) => setReasonFilter(event.target.value as AdminReportReason | '')}
                className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
              >
                <option value="">全部原因</option>
                {Object.entries(REPORT_REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-5 space-y-3">
            {listLoading ? <p className="text-sm text-muted-foreground">正在加载举报列表...</p> : null}
            {listError ? <p className="text-sm text-destructive">{listError}</p> : null}
            {!listLoading && !listError && reports.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
                当前筛选条件下没有举报记录。
              </p>
            ) : null}
            {reports.map((report) => {
              const active = report.id === selectedReportId
              return (
                <button
                  key={report.id}
                  type="button"
                  data-testid={`admin-report-row-${report.id}`}
                  onClick={() => setSelectedReportId(report.id)}
                  className={`w-full rounded-2xl border p-4 text-left transition-colors ${
                    active
                      ? 'border-foreground bg-foreground text-background'
                      : 'border-border/60 bg-background/70 hover:border-foreground/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">{report.reported_display_name}</p>
                      <p className={`mt-1 text-xs ${active ? 'text-background/75' : 'text-muted-foreground'}`}>
                        {report.reported_short_id ? `#${report.reported_short_id}` : 'ID 未生成'}
                      </p>
                      <p className={`mt-1 text-xs ${active ? 'text-background/75' : 'text-muted-foreground'}`}>
                        {report.reported_email_masked ?? '无邮箱'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusBadge status={report.status} />
                      {report.reported_account_chat_access_restricted ? (
                        <Badge
                          variant="outline"
                          className={
                            active
                              ? 'border-background/30 bg-background/15 text-background'
                              : 'border-destructive/20 bg-destructive/5 text-destructive'
                          }
                        >
                          已限制聊天
                        </Badge>
                      ) : null}
                    </div>
                  </div>

                  <div className={`mt-3 flex flex-wrap gap-2 ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                    <ReasonBadge reason={report.reason} />
                  </div>

                  <div className={`mt-3 grid gap-1 text-xs ${active ? 'text-background/80' : 'text-muted-foreground'}`}>
                    <span>
                      举报人：{report.reporter_display_name}
                      {report.reporter_short_id ? ` · #${report.reporter_short_id}` : ''}
                    </span>
                    <span>提交时间：{formatDateTime(report.created_at)}</span>
                    {report.reported_account_chat_access_restriction_report_id === report.id ? <span>当前限制来源：本举报</span> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
          {!selectedReportSummary && !detailLoading ? (
            <div className="flex h-full min-h-[420px] items-center justify-center rounded-3xl border border-dashed border-border/60 bg-background/60 p-6">
              <p className="text-sm text-muted-foreground">请选择一条举报查看详情。</p>
            </div>
          ) : null}

          {detailLoading ? <p className="text-sm text-muted-foreground">正在加载举报详情...</p> : null}
          {detailError ? <p className="text-sm text-destructive">{detailError}</p> : null}

          {reportDetail ? (
            <div data-testid="admin-report-detail" className="space-y-6">
              <div className="flex flex-col gap-3 border-b border-border/60 pb-5 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-2xl font-semibold text-foreground">举报 #{reportDetail.id}</h2>
                    <StatusBadge status={reportDetail.status} />
                    <ReasonBadge reason={reportDetail.reason} />
                    {reportDetail.reported_account_chat_access_restricted ? (
                      <Badge variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive">
                        已限制聊天
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">提交于 {formatDateTime(reportDetail.created_at)}</p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-background/70 px-4 py-3 text-sm text-muted-foreground">
                  <div>chat_match_id：{reportDetail.chat_match_id}</div>
                  <div>reported_session_id：{reportDetail.reported_chat_session_id}</div>
                </div>
              </div>

              <div className="grid gap-3 rounded-3xl border border-border/60 bg-background/70 p-4 md:grid-cols-3">
                <div className="rounded-2xl border border-border/60 bg-card/90 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">举报状态</p>
                  <div className="mt-3">
                    <StatusBadge status={reportDetail.status} />
                  </div>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/90 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">账号治理</p>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {reportDetail.reported_account_chat_access_restricted ? '已限制聊天' : '未限制聊天'}
                  </p>
                </div>
                <div className="rounded-2xl border border-border/60 bg-card/90 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">本举报是否触发当前治理</p>
                  <p className="mt-3 text-sm font-medium text-foreground">
                    {reportDetail.governance_triggered_by_this_report ? '是，当前限制来源于本举报' : '否，当前限制来自其他举报或尚未治理'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <DetailRow label="举报人昵称" value={reportDetail.reporter_display_name} />
                <DetailRow label="举报人 short_id" value={reportDetail.reporter_short_id ? `#${reportDetail.reporter_short_id}` : null} />
                <DetailRow label="举报人邮箱" value={reportDetail.reporter_email} />
                <DetailRow label="被举报人昵称" value={reportDetail.reported_display_name} />
                <DetailRow label="被举报人 short_id" value={reportDetail.reported_short_id ? `#${reportDetail.reported_short_id}` : null} />
                <DetailRow label="被举报人邮箱" value={reportDetail.reported_email} />
                <DetailRow label="详情说明" value={reportDetail.details} />
                <DetailRow label="当前举报状态" value={REPORT_STATUS_LABELS[reportDetail.status]} />
                <DetailRow
                  label="当前限制状态"
                  value={
                    reportDetail.reported_account_chat_access_restricted
                      ? `已限制聊天${reportDetail.reported_account_chat_access_restriction_reason ? `：${reportDetail.reported_account_chat_access_restriction_reason}` : ''}`
                      : '未限制'
                  }
                />
                <DetailRow label="限制时间" value={formatDateTime(reportDetail.reported_account_chat_access_restricted_at)} />
                <DetailRow
                  label="治理来源"
                  value={
                    reportDetail.reported_account_chat_access_restriction_report_id
                      ? `举报 #${reportDetail.reported_account_chat_access_restriction_report_id} / ${
                          reportDetail.reported_account_chat_access_restriction_report_status
                            ? REPORT_STATUS_LABELS[reportDetail.reported_account_chat_access_restriction_report_status]
                            : '未知状态'
                        }`
                      : '当前未关联治理来源举报'
                  }
                />
                <DetailRow label="审核时间" value={formatDateTime(reportDetail.reviewed_at)} />
                <DetailRow label="审核备注" value={reportDetail.review_note} />
              </div>

              <div className="grid gap-4 rounded-3xl border border-border/60 bg-background/70 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">审核举报</h3>
                  <p className="mt-1 text-sm text-muted-foreground">仅 `open` 状态允许一次性流转到终态，审核备注必填。</p>
                </div>

                <label className="grid gap-2 text-sm text-muted-foreground">
                  审核结果
                  <select
                    value={reviewStatus}
                    onChange={(event) => setReviewStatus(event.target.value as Exclude<AdminReportStatus, 'open'>)}
                    className="h-10 rounded-xl border border-input bg-background px-3 text-sm text-foreground"
                  >
                    <option value="reviewed">reviewed</option>
                    <option value="dismissed">dismissed</option>
                    <option value="actioned">actioned</option>
                  </select>
                </label>

                <label className="grid gap-2 text-sm text-muted-foreground">
                  审核备注
                  <Textarea
                    data-testid="admin-review-note"
                    rows={4}
                    value={reviewNote}
                    onChange={(event) => setReviewNote(event.target.value)}
                    placeholder="填写处理结论或依据"
                  />
                </label>

                <Button
                  data-testid="admin-review-submit"
                  type="button"
                  onClick={submitReview}
                  disabled={submittingReview || reportDetail.status !== 'open'}
                >
                  {submittingReview ? '提交中...' : '提交审核'}
                </Button>
              </div>

              <div className="grid gap-4 rounded-3xl border border-border/60 bg-background/70 p-4">
                <div>
                  <h3 className="text-lg font-semibold text-foreground">账号治理</h3>
                  <p className="mt-1 text-sm text-muted-foreground">限制或恢复聊天访问后，详情、列表和受限名单会即时同步。</p>
                </div>

                <label className="grid gap-2 text-sm text-muted-foreground">
                  治理原因
                  <Input
                    data-testid="admin-account-action-reason"
                    value={accountActionReason}
                    onChange={(event) => setAccountActionReason(event.target.value)}
                    placeholder="填写限制或恢复原因"
                  />
                </label>

                <div className="flex flex-wrap gap-3">
                  <Button
                    data-testid="admin-restrict-account"
                    type="button"
                    variant="destructive"
                    disabled={submittingAccountAction || reportDetail.reported_account_chat_access_restricted}
                    onClick={() => void submitAccountAction('restrict')}
                  >
                    {submittingAccountAction ? '处理中...' : '限制聊天访问'}
                  </Button>
                  <Button
                    data-testid="admin-restore-account"
                    type="button"
                    variant="outline"
                    disabled={submittingAccountAction || !reportDetail.reported_account_chat_access_restricted}
                    onClick={() => void submitAccountAction('restore')}
                  >
                    {submittingAccountAction ? '处理中...' : '恢复聊天访问'}
                  </Button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">当前已限制聊天账号</h2>
            <p className="mt-1 text-sm text-muted-foreground">这里直接回显当前治理结果，刷新后也会保留当前状态与来源举报。</p>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadRestrictedAccounts()} disabled={restrictedLoading}>
            {restrictedLoading ? '刷新中...' : '刷新名单'}
          </Button>
        </div>

        <div className="mt-5 space-y-3">
          {restrictedLoading ? <p className="text-sm text-muted-foreground">正在加载受限账号...</p> : null}
          {restrictedError ? <p className="text-sm text-destructive">{restrictedError}</p> : null}
          {!restrictedLoading && !restrictedError && restrictedAccounts.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
              当前没有被限制聊天访问的账号。
            </p>
          ) : null}

          {restrictedAccounts.map((account) => (
            <article
              key={account.account_id}
              data-testid={`restricted-account-row-${account.account_id}`}
              className="rounded-2xl border border-border/60 bg-background/70 p-4"
            >
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold text-foreground">{account.display_name}</h3>
                    {account.short_id ? (
                      <Badge variant="outline" className="border-border/60 bg-background text-foreground">
                        #{account.short_id}
                      </Badge>
                    ) : null}
                    <Badge variant="outline" className="border-destructive/20 bg-destructive/5 text-destructive">
                      已限制聊天
                    </Badge>
                  </div>
                  <div className="grid gap-1 text-sm text-muted-foreground">
                    <span>邮箱：{account.email_masked ?? '无邮箱'}</span>
                    <span>限制时间：{formatDateTime(account.restricted_at)}</span>
                    <span>限制原因：{account.restriction_reason}</span>
                    <span>
                      来源举报：
                      {account.source_report_id
                        ? ` #${account.source_report_id} · ${account.source_report_reason ? REPORT_REASON_LABELS[account.source_report_reason] : '未知原因'} · ${
                            account.source_report_status ? REPORT_STATUS_LABELS[account.source_report_status] : '未知状态'
                          }`
                        : ' 无'}
                    </span>
                  </div>
                </div>

                <div className="grid gap-3 xl:w-[320px]">
                  <Input
                    value={restrictedRestoreReasons[account.account_id] ?? ''}
                    onChange={(event) =>
                      setRestrictedRestoreReasons((current) => ({
                        ...current,
                        [account.account_id]: event.target.value
                      }))
                    }
                    placeholder="填写恢复聊天访问原因"
                  />
                  <div className="flex flex-wrap gap-2">
                    {account.source_report_id ? (
                      <Button type="button" variant="outline" onClick={() => setSelectedReportId(account.source_report_id)}>
                        查看来源举报
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      data-testid={`restore-restricted-account-${account.account_id}`}
                      disabled={restoringAccountId === account.account_id}
                      onClick={() => void restoreRestrictedAccount(account)}
                    >
                      {restoringAccountId === account.account_id ? '恢复中...' : '恢复聊天访问'}
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
