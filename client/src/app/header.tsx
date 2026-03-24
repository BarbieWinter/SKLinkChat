/**
 * App header.
 */
import { useAppStore } from '@/app/store'
import OnlineUserCount from '@/features/presence/ui/online-user-count'
import { useI18n } from '@/shared/i18n/use-i18n'

import { ModeToggle } from './mode-toggle'

const LanguageToggle = () => {
  const { language, setLanguage } = useAppStore()

  return (
    <button
      type="button"
      onClick={() => setLanguage(language === 'en' ? 'zh-CN' : 'en')}
      className="rounded-md border border-border px-2 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
    >
      {language === 'en' ? '中文' : 'EN'}
    </button>
  )
}

const Header = () => {
  const { t } = useI18n()

  return (
    <header className="flex items-center justify-between py-3 md:py-4">
      <h1 className="text-[1.85rem] font-bold tracking-tight">{t('app.title')}</h1>
      <div className="flex items-center gap-2">
        <OnlineUserCount />
        <LanguageToggle />
        <ModeToggle />
      </div>
    </header>
  )
}

export default Header
