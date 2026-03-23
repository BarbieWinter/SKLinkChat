/**
 * 在线人数轮询间隔，单位为毫秒。
 */
export const REFRESH_INTERVAL = 2_500

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '')

const getBrowserOrigin = () => {
  if (typeof window === 'undefined') return ''
  return window.location.origin
}

const getDefaultBackendOrigin = () => {
  if (typeof window === 'undefined') return ''

  const url = new URL(window.location.origin)

  // 本地开发时前端通常跑在 Vite 默认端口，后端固定跑在 9000。
  if (url.port === '5173' || url.port === '4173') {
    url.port = '9000'
  }

  return trimTrailingSlash(url.toString())
}

const normalizeConfiguredUrl = (value?: string) => {
  if (!value || value.trim().length === 0) return ''
  return trimTrailingSlash(value.trim())
}

const getApiBaseUrlFromWebSocketUrl = (configuredWebSocketUrl?: string) => {
  const normalizedWebSocketUrl = normalizeConfiguredUrl(configuredWebSocketUrl)
  if (!normalizedWebSocketUrl) return ''

  try {
    const url = new URL(normalizedWebSocketUrl)
    url.protocol = url.protocol === 'wss:' ? 'https:' : 'http:'
    url.pathname = ''
    url.search = ''
    url.hash = ''
    return trimTrailingSlash(url.toString())
  } catch {
    return ''
  }
}

const resolveBaseUrl = (configuredValue?: string) => {
  const normalizedConfiguredValue = normalizeConfiguredUrl(configuredValue)
  if (normalizedConfiguredValue) return normalizedConfiguredValue

  // 部署时如果只显式配置了 WebSocket 地址，则复用它推导对应的 HTTP API 地址。
  const baseUrlFromWebSocket = getApiBaseUrlFromWebSocketUrl(import.meta.env.VITE_WS_ENDPOINT)
  if (baseUrlFromWebSocket) return baseUrlFromWebSocket

  return getDefaultBackendOrigin()
}

/**
 * HTTP 接口基础地址：优先使用显式环境变量，其次回退到当前站点源。
 * 这样在部署环境未配置 VITE_ENDPOINT 时，在线人数接口仍能工作。
 */
export const API_BASE_URL = resolveBaseUrl(import.meta.env.VITE_ENDPOINT)

/**
 * WebSocket 地址：优先使用显式环境变量；如果未配置，则根据当前页面协议自动推导 ws/wss 地址。
 */
export const WS_ENDPOINT = (() => {
  const configuredWebSocketUrl = normalizeConfiguredUrl(import.meta.env.VITE_WS_ENDPOINT)
  if (configuredWebSocketUrl) return configuredWebSocketUrl

  if (typeof window === 'undefined') return ''

  const url = new URL('/ws', getDefaultBackendOrigin() || getBrowserOrigin())
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:'
  return url.toString()
})()
