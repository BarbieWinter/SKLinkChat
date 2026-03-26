import { ShieldAlert } from 'lucide-react'

export const RestrictedChatAccessCard = () => {
  return (
    <div className="flex h-full items-center justify-center px-4 py-8">
      <div className="w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">聊天功能不可用</h1>
            <p className="mt-0.5 text-sm text-muted-foreground">当前账号暂时无法进入匹配和聊天。</p>
          </div>
        </div>

        <div className="rounded-xl bg-muted/40 p-4 text-sm text-muted-foreground">
          你的账户仍可保持登录，但聊天功能当前不可用。如需协助，请联系支持渠道处理。
        </div>
      </div>
    </div>
  )
}
