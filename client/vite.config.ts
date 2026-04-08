import react from '@vitejs/plugin-react-swc'
import { defineConfig } from 'vite'

import path from 'path'

export default defineConfig(() => {
  const previewAllowedHosts = ['localhost', '127.0.0.1', '154.94.233.250', 'sklinkchat.com', 'www.sklinkchat.com']

  return {
    plugins: [react()],
    envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
    },
    server: {
      host: '0.0.0.0',
      port: 5173,
      allowedHosts: true
    },
    preview: {
      host: '0.0.0.0',
      port: 4173,
      allowedHosts: previewAllowedHosts
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            'vendor-react': ['react', 'react-dom', 'react-router-dom'],
            'vendor-stack-auth': ['@stackframe/react'],
            'vendor-ui': [
              '@radix-ui/react-dialog',
              '@radix-ui/react-label',
              '@radix-ui/react-slot',
              '@radix-ui/react-toast'
            ]
          }
        }
      }
    }
  }
})
