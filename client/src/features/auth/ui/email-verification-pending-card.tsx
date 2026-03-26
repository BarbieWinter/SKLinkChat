import { LogOut, MailCheck } from 'lucide-react'

import { useAuth } from '@/features/auth/auth-provider'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { useToast } from '@/shared/ui/use-toast'

export const EmailVerificationPendingCard = () => {
  const { t } = useI18n()
  const { toast } = useToast()
  const { logout, resendVerificationEmail, verifyMessage, verifyStatus } = useAuth()

  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-400/20 text-amber-600">
            <MailCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">等待邮箱验证</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">验证完成前，无法进入匹配和聊天。</p>
          </div>
        </div>

        {verifyMessage && (
          <div
            className={cn(
              'rounded-xl px-3 py-2 text-sm',
              verifyStatus === 'success'
                ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                : 'bg-destructive/10 text-destructive'
            )}
          >
            {verifyMessage}
          </div>
        )}

        <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          当前账号已登录，但还没有通过邮箱验证。你可以重新发送验证邮件，验证完成后刷新页面即可进入聊天。
        </div>

        <div className="flex gap-3">
          <Button
            className="flex-1 rounded-xl"
            onClick={async () => {
              try {
                await resendVerificationEmail()
                toast({ title: '已发送', description: '新的验证邮件已发送。' })
              } catch (error) {
                toast({
                  title: t('common.error'),
                  description: error instanceof Error ? error.message : '发送失败。',
                  variant: 'destructive'
                })
              }
            }}
          >
            重新发送验证邮件
          </Button>
          <Button
            variant="outline"
            className="group rounded-xl transition-all duration-200 hover:border-destructive/30 hover:bg-destructive/10 hover:text-destructive active:scale-95"
            onClick={async () => {
              await logout()
            }}
          >
            <LogOut className="mr-1.5 h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            退出登录
          </Button>
        </div>
      </div>
    </div>
  )
}
