import react from '@vitejs/plugin-react-swc'
import { defineConfig, loadEnv } from 'vite'

import path from 'path'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const geetestEnabled = env.VITE_GEETEST_ENABLED || env.SERVER_PY_GEETEST_ENABLED || 'false'
  const geetestRegisterCaptchaId =
    env.VITE_GEETEST_REGISTER_CAPTCHA_ID || env.SERVER_PY_GEETEST_REGISTER_CAPTCHA_ID || ''
  const geetestLoginCaptchaId = env.VITE_GEETEST_LOGIN_CAPTCHA_ID || env.SERVER_PY_GEETEST_LOGIN_CAPTCHA_ID || ''
  const previewAllowedHosts = ['localhost', '127.0.0.1', '154.94.233.250', 'sklinkchat.com', 'www.sklinkchat.com']

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GEETEST_ENABLED': JSON.stringify(geetestEnabled),
      'import.meta.env.VITE_GEETEST_REGISTER_CAPTCHA_ID': JSON.stringify(geetestRegisterCaptchaId),
      'import.meta.env.VITE_GEETEST_LOGIN_CAPTCHA_ID': JSON.stringify(geetestLoginCaptchaId)
    },
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
