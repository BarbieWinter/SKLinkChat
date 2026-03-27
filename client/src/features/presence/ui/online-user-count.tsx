/**
 * Online user count badge backed by the active HTTP contract.
 */
import { motion, AnimatePresence } from 'framer-motion'
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
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold tracking-tight shadow-sm transition-colors duration-300 ${
        hasOnlineCount
          ? 'bg-green-500/10 text-green-600 dark:bg-green-500/15 dark:text-green-400 ring-1 ring-green-500/20'
          : 'bg-muted/70 text-muted-foreground ring-1 ring-border/50'
      }`}
      title={isUnavailable ? t('users.unavailable') : t('users.online')}
    >
      <div className="relative flex h-2 w-2">
        {hasOnlineCount && (
          <motion.span
            animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inline-flex h-full w-full rounded-full bg-green-400/60"
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full shadow-sm ${
            hasOnlineCount ? 'bg-green-500' : 'bg-muted-foreground/60'
          }`}
        />
      </div>
      <div className="flex items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={query.data ?? 'none'}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.2 }}
          >
            {hasOnlineCount ? query.data : '--'}
          </motion.span>
        </AnimatePresence>
        <span className="ml-1 opacity-80 uppercase text-[9px] tracking-wider">{t('users.online')}</span>
      </div>
    </motion.div>
  )
}

export default OnlineUserCount
