/**
 * Online user count badge backed by the active HTTP contract.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from 'react-query'

import {
  ONLINE_USER_COUNT_QUERY_KEY,
  getOnlineCount,
  wsPresenceTracker
} from '@/features/presence/api/get-online-count'
import { REFRESH_INTERVAL } from '@/shared/config/runtime'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'

type OnlineUserCountProps = {
  className?: string
}

const OnlineUserCount = ({ className }: OnlineUserCountProps) => {
  const { t } = useI18n()
  const query = useQuery<number>(ONLINE_USER_COUNT_QUERY_KEY, ({ signal }) => getOnlineCount(signal), {
    // 轮询策略：若 WS 在最近一个轮询周期内已推送过人数，则跳过 HTTP 请求。
    // 这样可防止 in-flight 的 HTTP 响应（携带旧快照）覆盖 WS 推送的最新值。
    // 若 WS 长时间未推送（WS 断开），则回退到 HTTP 轮询兜底。
    refetchInterval: (_, currentQuery) => {
      if (currentQuery.state.error) return false
      const msSinceWsPush = Date.now() - wsPresenceTracker.lastPushedAt
      if (msSinceWsPush < REFRESH_INTERVAL) return false
      return REFRESH_INTERVAL
    },
    // WS setQueryData 写入后，staleTime 内不触发重新 fetch，防止 HTTP 旧快照覆盖 WS 推送的新值。
    staleTime: REFRESH_INTERVAL,
    refetchOnWindowFocus: false,
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
