import { Flag } from 'lucide-react'
import { useEffect, useState } from 'react'

import { createChatReport, type CreateChatReportPayload } from '@/features/chat/api/create-report'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/shared/ui/dialog'
import { Textarea } from '@/shared/ui/textarea'
import { useToast } from '@/shared/ui/use-toast'

const REPORT_OPTIONS: Array<{
  value: CreateChatReportPayload['reason']
  label: string
}> = [
  { value: 'harassment', label: '骚扰/辱骂' },
  { value: 'sexual_content', label: '性相关不适内容' },
  { value: 'spam', label: '垃圾消息' },
  { value: 'hate_speech', label: '仇恨言论' },
  { value: 'other', label: '其他' }
]

type ChatReportDialogProps = {
  sessionId: string
  reportedSessionId: string
  partnerName: string
  partnerShortId?: string | null
  triggerClassName?: string
  triggerLabel?: string
}

const ChatReportDialog = ({
  sessionId,
  reportedSessionId,
  partnerName,
  partnerShortId,
  triggerClassName,
  triggerLabel = '举报'
}: ChatReportDialogProps) => {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<CreateChatReportPayload['reason']>('harassment')
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) {
      setReason('harassment')
      setDetails('')
      setSubmitting(false)
      setErrorMessage(null)
    }
  }, [open])

  const submitReport = async () => {
    const normalizedDetails = details.trim()
    if (reason === 'other' && !normalizedDetails) {
      setErrorMessage('选择“其他”时必须填写详细说明。')
      toast({
        title: '请补充说明',
        description: '选择“其他”时必须填写详细说明。',
        variant: 'destructive'
      })
      return
    }

    setSubmitting(true)
    setErrorMessage(null)
    try {
      await createChatReport({
        session_id: sessionId,
        reported_session_id: reportedSessionId,
        reason,
        details: normalizedDetails || undefined
      })
      toast({
        title: '举报已提交',
        description: `已记录你对 ${partnerName} 的举报。`
      })
      setOpen(false)
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : '举报提交失败。')
      toast({
        title: '提交失败',
        description: error instanceof Error ? error.message : '举报提交失败。',
        variant: 'destructive'
      })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className={`flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-destructive transition-all duration-200 hover:bg-destructive/10 hover:scale-105 active:scale-95 ${triggerClassName ?? ''}`}
        >
          <Flag className="h-3 w-3" />
          {triggerLabel}
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="gap-3">
          <DialogTitle>举报当前聊天对象</DialogTitle>
          <DialogDescription className="text-start">
            仅针对当前正在进行的 1 对 1 聊天。系统不会向对方暴露你的真实身份。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground">
            当前对象：
            <span className="font-medium text-foreground"> {partnerName}</span>
            {partnerShortId ? <span className="ml-2 font-medium text-foreground">· #{partnerShortId}</span> : null}
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {REPORT_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  setReason(option.value)
                  setErrorMessage(null)
                }}
                className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                  reason === option.value
                    ? 'border-destructive bg-destructive/10 text-destructive'
                    : 'border-border bg-background hover:bg-muted/40'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          <Textarea
            value={details}
            onChange={(event) => {
              setDetails(event.target.value)
              if (errorMessage) {
                setErrorMessage(null)
              }
            }}
            rows={4}
            placeholder={reason === 'other' ? '请填写详细说明（必填）' : '补充说明（可选）'}
          />

          {errorMessage && <p className="text-sm text-destructive">{errorMessage}</p>}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
            取消
          </Button>
          <Button type="button" variant="destructive" onClick={submitReport} disabled={submitting}>
            {submitting ? '提交中...' : '提交举报'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default ChatReportDialog
