import { stackClientApp } from '@/features/auth/stack-client'

const STACK_ACCESS_TOKEN_TIMEOUT_MS = 2500

const isObjectLike = (value: HeadersInit | undefined): value is Record<string, string> =>
  Boolean(value) && !Array.isArray(value) && !(value instanceof Headers)

const resolveWithTimeout = async <T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> => {
  return new Promise((resolve) => {
    const timeoutId = window.setTimeout(() => resolve(null), timeoutMs)
    promise
      .then((value) => {
        window.clearTimeout(timeoutId)
        resolve(value)
      })
      .catch(() => {
        window.clearTimeout(timeoutId)
        resolve(null)
      })
  })
}

export const resolveStackAccessToken = async (): Promise<string | null> => {
  if (!stackClientApp) {
    return null
  }

  return await resolveWithTimeout(stackClientApp.getAccessToken(), STACK_ACCESS_TOKEN_TIMEOUT_MS)
}

export const resolveAuthHeaders = async (initialHeaders?: HeadersInit): Promise<Record<string, string>> => {
  const mergedHeaders: Record<string, string> = {}

  if (initialHeaders instanceof Headers) {
    initialHeaders.forEach((value, key) => {
      mergedHeaders[key] = value
    })
  } else if (Array.isArray(initialHeaders)) {
    for (const [key, value] of initialHeaders) {
      mergedHeaders[key] = value
    }
  } else if (isObjectLike(initialHeaders)) {
    Object.assign(mergedHeaders, initialHeaders)
  }

  if (stackClientApp) {
    const [stackAuthHeaders, accessToken] = await Promise.all([
      resolveWithTimeout(stackClientApp.getAuthHeaders(), STACK_ACCESS_TOKEN_TIMEOUT_MS),
      resolveStackAccessToken()
    ])

    if (stackAuthHeaders?.['x-stack-auth']) {
      mergedHeaders['x-stack-auth'] = stackAuthHeaders['x-stack-auth']
    }
    if (accessToken) {
      mergedHeaders['x-stack-access-token'] = accessToken
    }
  }

  return mergedHeaders
}
