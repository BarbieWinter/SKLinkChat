import { motion } from 'framer-motion'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'
import { RestrictedChatAccessCard } from '@/features/auth/ui/restricted-chat-access-card'
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace'

const HomePage = () => {
  const { authSession, status } = useAuth()

  if (status === 'loading') {
    return (
      <div className="relative flex h-[calc(100dvh-5rem)] items-center justify-center px-4">
        <div className="relative flex flex-col items-center">
          <motion.div
            animate={{
              rotate: 360,
              scale: [1, 1.1, 1]
            }}
            transition={{
              rotate: { duration: 2, repeat: Infinity, ease: 'linear' },
              scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' }
            }}
            className="h-10 w-10 rounded-full border-2 border-primary/20 border-t-primary"
          />
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mt-4 text-sm font-medium text-muted-foreground"
          >
            正在加载账户状态...
          </motion.div>
        </div>
      </div>
    )
  }

  if (!authSession.authenticated) {
    return <Navigate to="/auth/stack?mode=signin" replace />
  }

  if (authSession.chat_access_restricted) {
    return <RestrictedChatAccessCard />
  }

  return <ChatWorkspace />
}

export default HomePage
