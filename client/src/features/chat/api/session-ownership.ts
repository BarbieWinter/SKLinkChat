const SESSION_STORAGE_KEY = 'sklinkchat-session-id'
const SESSION_CHANNEL_NAME = 'sklinkchat-session-ownership'
const SESSION_CLAIM_TIMEOUT_MS = 160

export const getStoredSessionId = () => {
  if (typeof window === 'undefined') {
    return ''
  }

  return window.sessionStorage.getItem(SESSION_STORAGE_KEY) ?? ''
}

export const clearStoredSessionId = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.removeItem(SESSION_STORAGE_KEY)
}

export const setStoredSessionId = (sessionId: string) => {
  if (typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(SESSION_STORAGE_KEY, sessionId)
}

export const createOwnershipChannel = () => {
  if (typeof BroadcastChannel === 'undefined') {
    return null
  }

  return new BroadcastChannel(SESSION_CHANNEL_NAME)
}

export const createInstanceId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `instance-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const resolveSessionOwnership = async ({
  candidateSessionId,
  channel,
  instanceId,
  pendingClaims
}: {
  candidateSessionId: string
  channel: BroadcastChannel | null
  instanceId: string
  pendingClaims: Map<string, (owned: boolean) => void>
}) => {
  if (!channel || !candidateSessionId) {
    return false
  }

  const requestId = `${instanceId}-${Date.now()}`

  return await new Promise<boolean>((resolve) => {
    const timeout = window.setTimeout(() => {
      pendingClaims.delete(requestId)
      resolve(false)
    }, SESSION_CLAIM_TIMEOUT_MS)

    pendingClaims.set(requestId, (owned) => {
      window.clearTimeout(timeout)
      resolve(owned)
    })

    channel.postMessage({
      type: 'claim-check',
      requestId,
      sessionId: candidateSessionId,
      instanceId
    })
  })
}
