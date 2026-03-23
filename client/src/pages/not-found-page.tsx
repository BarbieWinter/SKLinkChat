/**
 * Not found page.
 */
import { useI18n } from '@/shared/i18n/use-i18n'
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
