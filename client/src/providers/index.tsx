import { Toaster } from '@/components/ui/toaster'
import { ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from 'react-query'
import { ChatProvider } from './chat-provider'
import { ThemeProvider } from './theme-provider'

const queryClient = new QueryClient()

const Providers: React.FC<{ children: ReactNode }> = ({ children }) => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
        <ChatProvider>
          {children}
          <Toaster />
        </ChatProvider>
      </ThemeProvider>
    </QueryClientProvider>
  )
}

export default Providers
