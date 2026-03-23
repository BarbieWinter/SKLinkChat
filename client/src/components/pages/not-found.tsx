/**
 * 兜底页面：用于显示未匹配路由或路由运行时错误信息。
 */
import { useI18n } from '@/hooks/useI18n'
import { useRouteError } from 'react-router-dom'

const NotFound = () => {
  const { t } = useI18n()
  const error = useRouteError() as { statusText?: string; message?: string }

  return (
    <div className="container flex flex-col space-y-4">
      <h1 className="text-4xl">{t('notFound.title')}</h1>
      <p>{t('notFound.description')}</p>
      <p>
        <i>{error.statusText || error.message}</i>
      </p>
    </div>
  )
}

export default NotFound
