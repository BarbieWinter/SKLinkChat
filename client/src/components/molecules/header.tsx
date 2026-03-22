import { useI18n } from '@/hooks/useI18n'
import { ModeToggle } from './mode-toggle'

const Header = () => {
  const { t } = useI18n()

  return (
    <header className="flex justify-between py-4">
      <h1 className="text-2xl font-bold">{t('app.title')}</h1>
      <ModeToggle />
    </header>
  )
}

export default Header
