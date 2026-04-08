/**
 * Global provider composition.
 */
import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { StackProvider, StackTheme } from '@stackframe/react'

import { AuthProvider } from '@/features/auth/auth-provider'
import { stackClientApp } from '@/features/auth/stack-client'
import { ChatProvider } from '@/features/chat/chat-provider'
import { Toaster } from '@/shared/ui/toaster'

import { ThemeProvider } from './theme-provider'

const queryClient = new QueryClient()

const Providers: React.FC<{ children: ReactNode }> = ({ children }) => {
  const appTree = (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <AuthProvider>
          <ChatProvider>
            {children}
            <Toaster />
          </ChatProvider>
        </AuthProvider>
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
