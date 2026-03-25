import { useEffect, useMemo, useRef, useState } from 'react'

import { createSession } from '@/features/chat/api/create-session'
import {
  clearStoredSessionId,
  createInstanceId,
  createOwnershipChannel,
  getStoredSessionId,
  resolveSessionOwnership,
  setStoredSessionId
} from '@/features/chat/api/session-ownership'

type UseSessionBootstrapOptions = {
  onError: (error: unknown) => void
}

export type SessionBootstrapStatus = 'bootstrapping' | 'ready' | 'error'

export const useSessionBootstrap = ({ onError }: UseSessionBootstrapOptions) => {
  const [sessionId, setSessionId] = useState('')
  const [status, setStatus] = useState<SessionBootstrapStatus>('bootstrapping')
  const [attempt, setAttempt] = useState(0)
  const instanceId = useMemo(() => createInstanceId(), [])
  const channel = useMemo(() => createOwnershipChannel(), [])
  const pendingClaimsRef = useRef(new Map<string, (owned: boolean) => void>())

  useEffect(() => {
    if (!channel) {
      return
    }

    const onChannelMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: 'claim-check' | 'claim-response'
            requestId?: string
            sessionId?: string
            instanceId?: string
          }
        | undefined

      if (!data?.type || !data.sessionId) {
        return
      }

      if (data.type === 'claim-check') {
        if (!sessionId || data.sessionId !== sessionId || data.instanceId === instanceId) {
          return
        }

        channel.postMessage({
          type: 'claim-response',
          requestId: data.requestId,
          sessionId: data.sessionId,
          instanceId
        })
        return
      }

      if (data.type === 'claim-response' && data.instanceId !== instanceId && data.requestId) {
        const resolver = pendingClaimsRef.current.get(data.requestId)
        if (!resolver) {
          return
        }

        pendingClaimsRef.current.delete(data.requestId)
        resolver(true)
      }
    }

    channel.addEventListener('message', onChannelMessage as EventListener)

    return () => {
      channel.removeEventListener('message', onChannelMessage as EventListener)
    }
  }, [channel, instanceId, sessionId])

  useEffect(() => {
    if (sessionId) {
      return
    }

    let cancelled = false

    const bootstrap = async () => {
      setStatus('bootstrapping')

      try {
        const storedSessionId = getStoredSessionId()
        if (storedSessionId) {
          const ownedByAnotherTab = await resolveSessionOwnership({
            candidateSessionId: storedSessionId,
            channel,
            instanceId,
            pendingClaims: pendingClaimsRef.current
          })

          if (cancelled) {
            return
          }

          if (!ownedByAnotherTab) {
            setSessionId(storedSessionId)
            setStatus('ready')
            return
          }

          clearStoredSessionId()
        }

        const session = await createSession()
        if (cancelled) {
          return
        }

        setStoredSessionId(session.session_id)
        setSessionId(session.session_id)
        setStatus('ready')
      } catch (error) {
        if (!cancelled) {
          setStatus('error')
          onError(error)
        }
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
      pendingClaimsRef.current.clear()
    }
  }, [attempt, channel, instanceId, onError, sessionId])

  return {
    retry: () => {
      pendingClaimsRef.current.clear()
      setStatus('bootstrapping')
      setAttempt((currentAttempt) => currentAttempt + 1)
    },
    sessionId,
    status
  }
}
