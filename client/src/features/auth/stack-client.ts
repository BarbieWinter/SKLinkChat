import { StackClientApp } from '@stackframe/react'

const readEnv = (value: string | undefined) => value?.trim() ?? ''

const stackProjectId = readEnv(import.meta.env.VITE_STACK_PROJECT_ID)
const stackPublishableClientKey = readEnv(import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY)

export const stackAuthEnabled = stackProjectId.length > 0 && stackPublishableClientKey.length > 0
export const stackAuthMode = readEnv(import.meta.env.VITE_AUTH_MODE).toLowerCase() || 'legacy'

export const stackClientApp = stackAuthEnabled
  ? new StackClientApp({
      projectId: stackProjectId,
      publishableClientKey: stackPublishableClientKey,
      tokenStore: 'cookie',
      urls: {
        handler: '/handler',
        afterSignIn: '/',
        afterSignUp: '/',
        afterSignOut: '/'
      }
    })
  : null
