import { useEffect, useRef } from 'react'

import { useAppStore } from '@/app/store'
import { sendCloseSessionSignal } from '@/features/chat/api/close-session'
import { clearStoredSessionId } from '@/features/chat/api/session-ownership'

type UsePageCloseSignalOptions = {
  sessionId: string
}

export const usePageCloseSignal = ({ sessionId }: UsePageCloseSignalOptions) => {
  const signaledRef = useRef(false)

  useEffect(() => {
    signaledRef.current = false

    const handlePageClose = () => {
      // Only an explicit page close clears the local chat history and tells the backend to notify the partner.
      if (!sessionId || signaledRef.current) {
        return
      }

      signaledRef.current = true
      sendCloseSessionSignal(sessionId)
      useAppStore.getState().clear()
      useAppStore.getState().disconnect()
      clearStoredSessionId()
    }

    window.addEventListener('pagehide', handlePageClose)
    window.addEventListener('beforeunload', handlePageClose)

    return () => {
      window.removeEventListener('pagehide', handlePageClose)
      window.removeEventListener('beforeunload', handlePageClose)
    }
  }, [sessionId])
}
