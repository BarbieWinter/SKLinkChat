/**
 * App header.
 */
import OnlineUserCount from '@/features/presence/ui/online-user-count'
import { useI18n } from '@/shared/i18n/use-i18n'

import { ModeToggle } from './mode-toggle'

const Header = () => {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between py-3 md:py-4">
      <h1 className="text-[1.85rem] font-bold tracking-tight">{t('app.title')}</h1>
      <div className="flex items-center gap-2">
        <OnlineUserCount />
        <ModeToggle />
      </div>
    </header>
  )
}

export default Header
