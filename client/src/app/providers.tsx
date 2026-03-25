/**
 * Global provider composition.
 */
import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'

import { AuthProvider } from '@/features/auth/auth-provider'
import { ChatProvider } from '@/features/chat/chat-provider'
import { Toaster } from '@/shared/ui/toaster'

import { ThemeProvider } from './theme-provider'

const queryClient = new QueryClient()

const Providers: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
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
}

export default Providers
