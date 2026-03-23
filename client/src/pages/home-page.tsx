/**
 * Home page container for chat.
 */
import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import ChatPanel from '@/features/chat/ui/chat-panel'
import SettingsDialog from '@/features/settings/ui/settings-dialog'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Contact, PanelLeftClose, PanelLeftOpen, Sparkles, Users } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

const HomePage = () => {
  const { t, formatUserState } = useI18n()
  const keywords = useAppStore((state) => state.keywords)
  const { stranger, me, connect } = useChat()
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isCompactViewport, setCompactViewport] = useState(false)
  const previousState = useRef<UserState | undefined>(me?.state)

  useEffect(() => {
    if (typeof window === 'undefined') return

    const syncViewport = () => {
      const compact = window.innerWidth < 1280
      setCompactViewport(compact)
      if (compact) {
        setSidebarCollapsed(true)
      }
    }

    syncViewport()
    window.addEventListener('resize', syncViewport)
    return () => window.removeEventListener('resize', syncViewport)
  }, [])

  useEffect(() => {
    if (me?.state === UserState.Connected && previousState.current !== UserState.Connected) {
      setSidebarCollapsed(true)
    }

    if (previousState.current === UserState.Connected && me?.state !== UserState.Connected && !isCompactViewport) {
      setSidebarCollapsed(false)
    }

    previousState.current = me?.state
  }, [isCompactViewport, me?.state])

  const buttonLabel =
    me?.state === UserState.Searching
      ? t('home.searching')
      : me?.state === UserState.Connected
        ? t('home.reroll')
        : t('home.startChat')

  const renderUnifiedPanel = () => (
    <div className="space-y-4 rounded-[28px] border border-border/70 bg-card/80 p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-primary/10 p-2 text-primary">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-semibold leading-tight">{t('home.title')}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{t('home.description')}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="rounded-2xl border border-border/70"
          onClick={() => setSidebarCollapsed(true)}
          aria-label="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      <Button
        disabled={me?.state === UserState.Searching}
        onClick={() => connect?.()}
        className="h-12 w-full rounded-2xl text-sm"
      >
        {buttonLabel}
      </Button>

      <div className="grid gap-4">
        <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-muted p-2 text-muted-foreground">
                <Contact className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">{t('home.profile')}</h3>
            </div>
            <Badge>{formatUserState(me?.state)}</Badge>
          </div>
          <p className="text-base font-semibold">{me?.name ?? '-'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {keywords.length > 0 ? (
              keywords.map((keyword) => (
                <Badge key={keyword} variant="outline" className="rounded-full">
                  {keyword}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">{t('home.interestsEmpty')}</span>
            )}
          </div>
          <div className="mt-5 text-sm text-muted-foreground">
            <SettingsDialog />
          </div>
        </div>

        <div className="rounded-[24px] border border-border/70 bg-background/60 p-4">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-muted p-2 text-muted-foreground">
                <Users className="h-4 w-4" />
              </div>
              <h3 className="font-semibold">{t('home.currentPartner')}</h3>
            </div>
            <Badge variant="outline">{formatUserState(stranger?.state)}</Badge>
          </div>
          {stranger ? (
            <p className="text-base font-semibold">{stranger.name}</p>
          ) : (
            <div className="space-y-2">
              <p className="text-sm font-medium">{t('home.noPartner')}</p>
              <p className="text-sm leading-6 text-muted-foreground">{t('home.noPartnerDescription')}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  const renderToolbar = () => (
    <div
      className={cn(
        'shrink-0 rounded-[24px] border border-border/70 bg-card/75 p-3 shadow-sm',
        isCompactViewport ? 'w-full' : 'w-[88px]'
      )}
    >
      <div className={cn('flex gap-3', isCompactViewport ? 'flex-row items-center justify-start' : 'flex-col items-center')}>
        <button
          type="button"
          onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-background text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isSidebarCollapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </button>
        <button
          type="button"
          onClick={() => setSidebarCollapsed(false)}
          className={cn(
            'flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl transition-colors',
            isSidebarCollapsed
              ? 'bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground'
              : 'bg-primary text-primary-foreground'
          )}
          aria-label={t('home.title')}
          title={t('home.title')}
        >
          <Sparkles className="h-5 w-5" />
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 xl:flex-row">
      <div className={cn('flex shrink-0 gap-4', isCompactViewport ? 'flex-col' : 'flex-row items-start')}>
        {renderToolbar()}
        {!isSidebarCollapsed && (
          <div
            className={cn('min-w-0', {
              'w-[326px]': !isCompactViewport,
              'w-full': isCompactViewport
            })}
          >
            {renderUnifiedPanel()}
          </div>
        )}
      </div>
      <div className="min-h-0 min-w-0 flex-1">
        <ChatPanel />
      </div>
    </div>
  )
}

export default HomePage
