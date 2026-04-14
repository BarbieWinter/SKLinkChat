import { motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'

import { useAuth } from '@/features/auth/auth-provider'
import { RestrictedChatAccessCard } from '@/features/auth/ui/restricted-chat-access-card'
import { SessionExpiredOverlay } from '@/features/auth/ui/session-expired-overlay'
import { ChatWorkspace } from '@/features/chat/ui/chat-workspace'
import { GenderSelectOverlay } from '@/features/gender-select/ui/GenderSelectOverlay'
import type { Gender } from '@/shared/types'

/** 定期检查 session 是否仍有效的间隔（5 分钟）*/
const SESSION_POLL_INTERVAL_MS = 5 * 60 * 1000

const HomePage = () => {
  const { authSession, status, syncProfile, refreshSession } = useAuth()

  // 记录"进入页面时确认已登录"的状态，用于区分：
  // - 初次加载就未登录（直接跳转登录页）
  // - 曾经登录但 session 在使用中失效（显示过期提示）
  const wasAuthenticatedRef = useRef(false)
  const [sessionExpired, setSessionExpired] = useState(false)

  // 在 session 有效期间标记已认证
  useEffect(() => {
    if (authSession.authenticated) {
      wasAuthenticatedRef.current = true
    }
  }, [authSession.authenticated])

  // 定期轮询 session 状态，及时感知服务端 session 失效
  useEffect(() => {
    if (status !== 'ready' || !authSession.authenticated) return

    const timer = setInterval(() => {
      void refreshSession()
    }, SESSION_POLL_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [status, authSession.authenticated, refreshSession])

  // 当 session 从已登录变为未登录（页面停留期间失效），显示过期提示而非直接跳转
  useEffect(() => {
    if (status === 'ready' && !authSession.authenticated && wasAuthenticatedRef.current) {
      setSessionExpired(true)
    }
  }, [status, authSession.authenticated])

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

  // Session 在使用中失效：显示过期提示，不跳转
  if (sessionExpired) {
    return <SessionExpiredOverlay />
  }

  // 初次加载就未登录：正常跳转
  if (!authSession.authenticated) {
    return <Navigate to="/auth/stack?mode=signin" replace />
  }

  if (authSession.chat_access_restricted) {
    return <RestrictedChatAccessCard />
  }

  const handleGenderSelect = async (gender: Gender) => {
    await syncProfile({ interests: authSession.interests ?? [], gender })
  }

  return (
    <>
      <ChatWorkspace />
      {authSession.gender === 'unknown' && <GenderSelectOverlay onSelect={handleGenderSelect} />}
    </>
  )
}

export default HomePage
