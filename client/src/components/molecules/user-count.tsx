/**
 * 在线人数组件：通过定时查询 `/users` 接口，显示当前在线连接数量。
 */
import { getUsers } from '@/lib/api'
import { REFRESH_INTERVAL } from '@/lib/config'
import { useI18n } from '@/hooks/useI18n'
import { User } from '@/types'
import { useQuery } from 'react-query'

const UserCount = () => {
  const { t } = useI18n()
  const query = useQuery<User[]>('getUsers', getUsers, {
    refetchInterval: REFRESH_INTERVAL
  })

  return (
    <h3>
      {t('users.online')}: <b>{query?.data?.length ?? 0}</b>
    </h3>
  )
}

export default UserCount
