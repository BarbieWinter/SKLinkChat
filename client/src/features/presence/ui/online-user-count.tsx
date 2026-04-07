/**
 * Online user count badge backed by the active HTTP contract.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'react-query'

import { ONLINE_USER_COUNT_QUERY_KEY, getOnlineCount } from '@/features/presence/api/get-online-count'
import { REFRESH_INTERVAL } from '@/shared/config/runtime'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'

type OnlineUserCountProps = {
  className?: string
}

const OnlineUserCount = ({ className }: OnlineUserCountProps) => {
  const { t } = useI18n()
  const query = useQuery<number>(ONLINE_USER_COUNT_QUERY_KEY, getOnlineCount, {
    refetchInterval: (_, currentQuery) => (currentQuery.state.error ? false : REFRESH_INTERVAL),
    retry: false
  })
  const hasOnlineCount = typeof query.data === 'number'
  const isUnavailable = query.isError && !hasOnlineCount

  return (
    <div
      className={cn('inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground', className)}
      title={isUnavailable ? t('users.unavailable') : t('users.online')}
    >
      <span
        className={`inline-flex h-1.5 w-1.5 rounded-full ${hasOnlineCount ? 'bg-terminal' : 'bg-muted-foreground/50'}`}
      />
      <AnimatePresence mode="wait">
        <motion.span
          key={query.data ?? 'none'}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="tabular-nums"
        >
          {hasOnlineCount ? query.data : '--'}
        </motion.span>
      </AnimatePresence>
      <span className="opacity-70 uppercase text-[10px] tracking-wider">{t('users.online')}</span>
    </div>
  )
}

export default OnlineUserCount
