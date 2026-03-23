/**
 * Online user count badge backed by the active HTTP contract.
 */
import { RadioTower } from 'lucide-react'
import { useQuery } from 'react-query'

import { getOnlineCount } from '@/features/presence/api/get-online-count'
import { useI18n } from '@/shared/i18n/use-i18n'
import { REFRESH_INTERVAL } from '@/shared/config/runtime'

const OnlineUserCount = () => {
  const { t } = useI18n()
  const query = useQuery<number>('onlineUserCount', getOnlineCount, {
    refetchInterval: REFRESH_INTERVAL
  })

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3 text-sm shadow-sm">
      <RadioTower className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground">{t('users.online')}</span>
      <b className="text-foreground">{query.data ?? 0}</b>
    </div>
  )
}

export default OnlineUserCount
