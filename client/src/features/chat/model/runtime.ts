export type SessionBootstrapStatus = 'bootstrapping' | 'ready' | 'error'

export type ChatTransportStatus = 'idle' | 'connecting' | 'connected' | 'reconnecting'

export type ChatRuntimeAvailability = 'disabled' | 'bootstrapping' | 'ready' | 'error'

export const getChatRuntimeAvailability = ({
  enabled,
  bootstrapStatus
}: {
  enabled: boolean
  bootstrapStatus: SessionBootstrapStatus
}): ChatRuntimeAvailability => {
  if (!enabled) {
    return 'disabled'
  }

  if (bootstrapStatus === 'error') {
    return 'error'
  }

  if (bootstrapStatus === 'bootstrapping') {
    return 'bootstrapping'
  }

  return 'ready'
}
