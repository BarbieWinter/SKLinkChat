import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'

import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const turnstileSiteKey = env.VITE_TURNSTILE_SITE_KEY || env.SERVER_PY_TURNSTILE_SITE_KEY || ''
  const turnstileEnabled = env.VITE_TURNSTILE_ENABLED || env.SERVER_PY_TURNSTILE_ENABLED || 'false'
  const previewAllowedHosts = [
    'localhost',
    '127.0.0.1',
    '154.94.233.250',
    'sklinkchat.com',
    'www.sklinkchat.com'
  ]

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_TURNSTILE_SITE_KEY': JSON.stringify(turnstileSiteKey),
      'import.meta.env.VITE_TURNSTILE_ENABLED': JSON.stringify(turnstileEnabled)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src')
      }
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
