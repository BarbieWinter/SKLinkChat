import { motion } from 'framer-motion'
import { ShieldAlert, Info } from 'lucide-react'

export const RestrictedChatAccessCard = () => {
  return (
    <div className="relative flex min-h-[calc(100dvh-5rem)] items-center justify-center overflow-hidden px-4 py-8">
      {/* Background blobs to match AuthEntryCard */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.1, 0.9, 1],
            opacity: [0.1, 0.15, 0.1, 0.1]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
          className="absolute left-1/4 top-1/4 h-64 w-64 rounded-full bg-destructive/20 blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="relative w-full max-w-md space-y-6 rounded-[28px] border border-border/60 bg-background/[0.82] p-7 shadow-2xl shadow-slate-900/10 backdrop-blur-xl"
      >
        <div className="flex items-start gap-4">
          <motion.div
            initial={{ rotate: -10, scale: 0.8 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-destructive/10 text-destructive shadow-inner"
          >
            <ShieldAlert className="h-7 w-7" />
          </motion.div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">聊天功能不可用</h1>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">当前账号暂时无法进入匹配和聊天。</p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 rounded-2xl border border-destructive/20 bg-destructive/5 p-4 text-sm leading-relaxed text-muted-foreground"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-destructive/60" />
          <p>由于违反社区准则或安全策略，你的账户聊天权限已被暂时限制。你仍可保持登录，但无法发送或接收消息。</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center"
        >
          <p className="text-sm text-muted-foreground">如有疑问，请通过官方渠道联系支持。</p>
        </motion.div>
      </motion.div>
    </div>
  )
}
