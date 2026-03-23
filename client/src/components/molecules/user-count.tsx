/**
 * 在线人数组件：通过定时查询 `/users` 接口，显示当前在线连接数量。
 */
import { useI18n } from '@/hooks/useI18n'
import { getUsers } from '@/lib/api'
import { REFRESH_INTERVAL } from '@/lib/config'
import { User } from '@/types'
import { RadioTower } from 'lucide-react'
import { useQuery } from 'react-query'

const UserCount = () => {
  const { t } = useI18n()
  const query = useQuery<User[]>('getUsers', getUsers, {
    refetchInterval: REFRESH_INTERVAL
  })

  return (
    <div className="inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-background px-3 text-sm shadow-sm">
      <RadioTower className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground">{t('users.online')}</span>
      <b className="text-foreground">{query?.data?.length ?? 0}</b>
    </div>
  )
}

export default UserCount
