/**
 * 欢迎页：提供简单的欢迎提示，当前属于轻量占位页面。
 */
import { useI18n } from '@/hooks/useI18n'

const Welcome = () => {
  const { t } = useI18n()

  return <div className="py-8 text-lg">{t('welcome.message')}</div>
}

export default Welcome
