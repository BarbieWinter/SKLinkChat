import { StackClientApp } from '@stackframe/react'

const readEnv = (value: string | undefined) => value?.trim() ?? ''
const env = import.meta.env as Record<string, string | undefined>

const stackProjectId = readEnv(env.VITE_STACK_PROJECT_ID || env.NEXT_PUBLIC_STACK_PROJECT_ID)
const stackPublishableClientKey = readEnv(
  env.VITE_STACK_PUBLISHABLE_CLIENT_KEY || env.NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY
)

export const stackAuthEnabled = stackProjectId.length > 0 && stackPublishableClientKey.length > 0
export const stackAuthMode = readEnv(env.VITE_AUTH_MODE).toLowerCase() || 'legacy'

export const stackClientApp = stackAuthEnabled
  ? new StackClientApp({
      projectId: stackProjectId,
      publishableClientKey: stackPublishableClientKey,
      tokenStore: 'cookie',
      urls: {
        handler: '/handler',
        afterSignIn: '/auth/stack?mode=signin',
        afterSignUp: '/auth/stack?mode=signin',
        afterSignOut: '/'
      }
    })
  : null
