import { useI18n } from '@/hooks/useI18n'

const Footer = () => {
  const { t } = useI18n()

  return (
    <footer className="py-4">
      <p className="text-sm leading-loose text-muted-foreground md:text-left">
        {t('footer.builtBy')}{' '}
        <a
          href="https://stormix.dev"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-4"
        >
          Stormix
        </a>
        . {t('footer.source')}{' '}
        <a
          href="https://github.com/Stormix/msn"
          target="_blank"
          rel="noreferrer"
          className="font-medium underline underline-offset-4"
        >
          GitHub
        </a>
        .
      </p>
    </footer>
  )
}

export default Footer
