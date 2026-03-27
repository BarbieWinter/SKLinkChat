import { useEffect, useState } from 'react'

import type { AdminAuditEvent } from '@/features/admin/api/admin-client'
import { listAuditEvents } from '@/features/admin/api/admin-client'
import { useAuth } from '@/features/auth/auth-provider'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'

const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value))

export const AdminAuditPage = () => {
  const { refreshSession } = useAuth()
  const [eventType, setEventType] = useState('')
  const [accountId, setAccountId] = useState('')
  const [chatSessionId, setChatSessionId] = useState('')
  const [items, setItems] = useState<AdminAuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

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

  const loadEvents = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const response = await runWithAdminRetry(() =>
        listAuditEvents({
          event_type: eventType || undefined,
          account_id: accountId || undefined,
          chat_session_id: chatSessionId || undefined
        })
      )
      setItems(response.items)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '审计日志加载失败。')
      setItems([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEvents()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <section
      data-testid="admin-audit-page"
      className="rounded-3xl border border-border/60 bg-card/90 p-5 shadow-xl shadow-black/5"
    >
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-foreground">审计日志</h2>
          <p className="mt-1 text-sm text-muted-foreground">按事件类型、账号或 chat session 过滤治理相关操作。</p>
        </div>
        <Button type="button" variant="outline" onClick={() => void loadEvents()} disabled={loading}>
          {loading ? '刷新中...' : '刷新'}
        </Button>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        <label className="grid gap-2 text-sm text-muted-foreground">
          event_type
          <Input
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            placeholder="admin.report.reviewed"
          />
        </label>
        <label className="grid gap-2 text-sm text-muted-foreground">
          account_id
          <Input value={accountId} onChange={(event) => setAccountId(event.target.value)} placeholder="目标账号 ID" />
        </label>
        <label className="grid gap-2 text-sm text-muted-foreground">
          chat_session_id
          <Input
            value={chatSessionId}
            onChange={(event) => setChatSessionId(event.target.value)}
            placeholder="chat session ID"
          />
        </label>
      </div>

      <div className="mt-4">
        <Button type="button" onClick={() => void loadEvents()} disabled={loading}>
          应用筛选
        </Button>
      </div>

      <div className="mt-5 space-y-3">
        {loading ? <p className="text-sm text-muted-foreground">正在加载审计日志...</p> : null}
        {errorMessage ? <p className="text-sm text-destructive">{errorMessage}</p> : null}
        {!loading && !errorMessage && items.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border/60 px-4 py-6 text-sm text-muted-foreground">
            当前筛选条件下没有审计事件。
          </p>
        ) : null}
        {items.map((item, index) => (
          <article
            key={item.id}
            data-testid={`admin-audit-row-${index}`}
            className="rounded-2xl border border-border/60 bg-background/70 p-4"
          >
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">{item.event_type}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{formatDateTime(item.created_at)}</p>
              </div>
              <div className="grid gap-1 text-sm text-muted-foreground md:text-right">
                <span>{item.account_display_name ?? '无账号昵称'}</span>
                <span>{item.account_short_id ? `#${item.account_short_id}` : '无 short_id'}</span>
                <span>{item.account_email_masked ?? '无脱敏邮箱'}</span>
                <span>{item.chat_session_id ?? '无 chat session'}</span>
              </div>
            </div>
            <pre className="mt-4 overflow-x-auto rounded-2xl bg-muted/50 p-3 text-xs text-foreground">
              {JSON.stringify(item.payload, null, 2)}
            </pre>
          </article>
        ))}
      </div>
    </section>
  )
}
