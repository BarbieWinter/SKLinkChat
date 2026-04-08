import { stackAuthMode, stackClientApp } from '@/features/auth/stack-client'

const isObjectLike = (value: HeadersInit | undefined): value is Record<string, string> =>
  Boolean(value) && !Array.isArray(value) && !(value instanceof Headers)

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

  if (stackAuthMode === 'stack' && stackClientApp) {
    const accessToken = await stackClientApp.getAccessToken().catch(() => null)
    if (accessToken) {
      mergedHeaders['x-stack-access-token'] = accessToken
    }
  }

  return mergedHeaders
}
