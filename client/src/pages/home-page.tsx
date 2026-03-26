import { useAuth } from '@/features/auth/auth-provider'
import { AuthEntryCard } from '@/features/auth/ui/auth-entry-card'
import { RestrictedChatAccessCard } from '@/features/auth/ui/restricted-chat-access-card'
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace'


const HomePage = () => {
  const { authSession, status, pendingVerificationEmail } = useAuth()

  if (status === 'loading') {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-border/50 bg-card/90 p-6 text-center shadow-xl shadow-black/5 dark:shadow-black/20">
          <p className="text-sm text-muted-foreground">正在加载账户状态...</p>
        </div>
      </div>
    )
  }

  if (!authSession.authenticated || pendingVerificationEmail) {
    return <AuthEntryCard />
  }

  if (authSession.chat_access_restricted) {
    return <RestrictedChatAccessCard />
  }

  return <ChatWorkspace />
}

export default HomePage
