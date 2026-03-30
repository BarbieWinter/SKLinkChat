import { afterEach, describe, expect, it, vi } from 'vitest'

const importRuntimeModule = async () => import('@/shared/config/runtime')

describe('runtime config', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('derives the websocket endpoint from the configured API base URL when VITE_WS_ENDPOINT is missing', async () => {
    vi.stubEnv('VITE_ENDPOINT', 'http://localhost:8000')
    vi.stubEnv('VITE_WS_ENDPOINT', '')

    const runtime = await importRuntimeModule()

    expect(runtime.API_BASE_URL).toBe('http://localhost:8000')
    expect(runtime.WS_ENDPOINT).toBe('ws://localhost:8000/ws')
  })

  it('keeps an explicit websocket endpoint unchanged', async () => {
    vi.stubEnv('VITE_ENDPOINT', 'http://localhost:8000')
    vi.stubEnv('VITE_WS_ENDPOINT', 'ws://192.168.0.101:8000/ws')

    const runtime = await importRuntimeModule()

    expect(runtime.WS_ENDPOINT).toBe('ws://192.168.0.101:8000/ws')
  })
})
