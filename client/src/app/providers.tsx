/**
 * Global provider composition.
 */
import { ReactNode, Suspense } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { StackProvider, StackTheme } from '@stackframe/react'

import { AuthProvider } from '@/features/auth/auth-provider'
import { stackClientApp } from '@/features/auth/stack-client'
import { ChatProvider } from '@/features/chat/chat-provider'
import { Toaster } from '@/shared/ui/toaster'

import { ThemeProvider } from './theme-provider'

const queryClient = new QueryClient()

const ProvidersSuspenseFallback = () => (
  <div className="flex min-h-screen items-center justify-center px-6">
    <p className="text-sm text-muted-foreground">正在加载账户状态...</p>
  </div>
)

const Providers: React.FC<{ children: ReactNode }> = ({ children }) => {
  const appTree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <Suspense fallback={<ProvidersSuspenseFallback />}>
          <AuthProvider>
            <ChatProvider>
              {children}
              <Toaster />
            </ChatProvider>
          </AuthProvider>
        </Suspense>
      </ThemeProvider>
    </QueryClientProvider>
  )

  if (!stackClientApp) {
    return appTree
  }

  return (
    <StackProvider app={stackClientApp}>
      <StackTheme>{appTree}</StackTheme>
    </StackProvider>
  )
}

export default Providers
