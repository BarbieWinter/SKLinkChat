import { motion } from 'framer-motion'
import { ShieldAlert, Info } from 'lucide-react'

export const RestrictedChatAccessCard = () => {
  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center px-4 py-8">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="relative w-full max-w-md space-y-6 rounded-lg border border-border bg-card p-6"
      >
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">聊天功能不可用</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">当前账号暂时无法进入匹配和聊天。</p>
          </div>
        </div>

        <div className="flex gap-3 rounded-md border border-destructive/20 bg-destructive/5 p-4 text-sm leading-relaxed text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
          <p>由于违反社区准则或安全策略，你的账户聊天权限已被暂时限制。你仍可保持登录，但无法发送或接收消息。</p>
        </div>

        <div className="text-center">
          <p className="text-sm text-muted-foreground">如有疑问，请通过官方渠道联系支持。</p>
        </div>
      </motion.div>
    </div>
  )
}
