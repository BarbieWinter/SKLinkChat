/**
 * Online user count badge backed by the active HTTP contract.
 */
import { useQuery } from 'react-query'

import { ONLINE_USER_COUNT_QUERY_KEY, getOnlineCount } from '@/features/presence/api/get-online-count'
import { REFRESH_INTERVAL } from '@/shared/config/runtime'
import { useI18n } from '@/shared/i18n/use-i18n'

const OnlineUserCount = () => {
  const { t } = useI18n()
  const query = useQuery<number>(ONLINE_USER_COUNT_QUERY_KEY, getOnlineCount, {
    refetchInterval: (_, currentQuery) => (currentQuery.state.error ? false : REFRESH_INTERVAL),
    retry: false
  })
  const hasOnlineCount = typeof query.data === 'number'
  const isUnavailable = query.isError && !hasOnlineCount

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs ${
        hasOnlineCount ? 'bg-green-500/10' : 'bg-muted/70'
      }`}
      title={isUnavailable ? t('users.unavailable') : t('users.online')}
    >
      <span className="relative flex h-2 w-2">
        {hasOnlineCount && (
          <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 animate-pulse-dot" />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${hasOnlineCount ? 'bg-green-500' : 'bg-muted-foreground/60'}`}
        />
      </span>
      <span className={`font-medium ${hasOnlineCount ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
        {hasOnlineCount ? query.data : '--'}
      </span>
    </div>
  )
}

export default OnlineUserCount
