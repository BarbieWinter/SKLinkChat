import { AuthPage, useUser } from '@stackframe/react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import { stackAuthEnabled } from '@/features/auth/stack-client'

const StackAuthPage = () => {
  const user = useUser()
  const [searchParams] = useSearchParams()
  const mode = searchParams.get('mode') === 'signup' ? 'sign-up' : 'sign-in'

  if (!stackAuthEnabled) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-lg border border-border bg-card p-6 text-card-foreground">
          <p className="text-sm leading-6">
            Stack Auth 尚未配置。请先在前端环境变量中设置 `VITE_STACK_PROJECT_ID` 与
            `VITE_STACK_PUBLISHABLE_CLIENT_KEY`。
          </p>
          <p className="mt-4 text-sm text-muted-foreground">
            配置完成后访问 <code>/auth/stack</code> 进行登录注册验证。
          </p>
          <Link to="/" className="mt-5 inline-block text-sm text-primary underline underline-offset-4">
            返回首页
          </Link>
        </div>
      </div>
    )
  }

  if (user) {
    return <Navigate to="/" replace />
  }

  return <AuthPage type={mode} firstTab="magic-link" fullPage />
}

export default StackAuthPage
