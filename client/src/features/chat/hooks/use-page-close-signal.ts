import { useEffect, useRef } from 'react'

import { sendCloseSessionSignal } from '@/features/chat/api/close-session'

type UsePageCloseSignalOptions = {
  sessionId: string
}

/**
 * Sends a lightweight close hint when the page is actually being destroyed (tab close / navigate away),
 * but does NOT clear the session or local state so that a simple refresh can reconnect seamlessly.
 *
 * The server uses its reconnect_window (180 s) as the real source of truth for session expiry.
 * The beacon is only an optimistic hint so the partner is notified faster when the user truly leaves.
 *
 * On a refresh the WebSocket reconnects within a few seconds, so the server cancels the pending
 * partner-disconnect notice before it fires (partner_disconnect_grace_seconds).
 */
export const usePageCloseSignal = ({ sessionId }: UsePageCloseSignalOptions) => {
  const signaledRef = useRef(false)

  useEffect(() => {
    signaledRef.current = false

    const handlePageClose = () => {
      if (!sessionId || signaledRef.current) {
        return
      }

      signaledRef.current = true
      // Send a lightweight hint so the server can start the grace timer.
      // We do NOT clear the session ID or local state — a refresh will reuse
      // the same session and the server will cancel the pending disconnect.
      sendCloseSessionSignal(sessionId)
    }

    window.addEventListener('pagehide', handlePageClose)

    return () => {
      window.removeEventListener('pagehide', handlePageClose)
    }
  }, [sessionId])
}
