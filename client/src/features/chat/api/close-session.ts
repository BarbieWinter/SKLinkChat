import { API_BASE_URL } from '@/shared/config/runtime'

export const sendCloseSessionSignal = (sessionId: string) => {
  const payload = new URLSearchParams({ session_id: sessionId })

  if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(`${API_BASE_URL}/api/session/close`, payload)
    return
  }

  void fetch(`${API_BASE_URL}/api/session/close`, {
    method: 'POST',
    body: JSON.stringify({ session_id: sessionId }),
    headers: {
      'Content-Type': 'application/json'
    },
    keepalive: true
  })
}
