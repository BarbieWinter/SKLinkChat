/**
 * 页面头部：展示应用标题和主题切换入口。
 */
import { useI18n } from '@/hooks/useI18n'
import { ModeToggle } from './mode-toggle'
import UserCount from './user-count'

const Header = () => {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between py-3 md:py-4">
      <h1 className="text-[1.85rem] font-bold tracking-tight">{t('app.title')}</h1>
      <div className="flex items-center gap-2">
        <UserCount />
        <ModeToggle />
      </div>
    </header>
  )
}

export default Header
