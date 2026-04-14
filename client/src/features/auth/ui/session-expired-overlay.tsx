import { motion } from 'framer-motion'
import { LogIn, RefreshCw } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

/**
 * 当用户已登录但 session 在使用过程中失效时，在聊天页面上方显示此全屏提示，
 * 引导用户重新登录，而不是静默跳转。
 */
export function SessionExpiredOverlay() {
  const navigate = useNavigate()

  return (
    <motion.div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-6 bg-background/95 backdrop-blur-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <motion.div
        className="flex flex-col items-center gap-4 px-6 text-center"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
      >
        {/* 图标 */}
        <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-muted">
          <RefreshCw className="h-6 w-6 text-muted-foreground" />
        </div>

        {/* 标题 */}
        <h2 className="text-lg font-bold text-foreground">登录已过期</h2>

        {/* 说明 */}
        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
          你的登录状态已失效，请重新登录后继续使用。
        </p>

        {/* 按钮 */}
        <button
          type="button"
          className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 active:scale-95"
          onClick={() => navigate('/auth/stack?mode=signin', { replace: true })}
        >
          <LogIn className="h-4 w-4" />
          重新登录
        </button>
      </motion.div>
    </motion.div>
  )
}
