import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const previewAllowedHosts = (
    env.VITE_PREVIEW_ALLOWED_HOSTS || 'localhost,127.0.0.1,sklinkchat.com,www.sklinkchat.com'
  )
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean)

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
