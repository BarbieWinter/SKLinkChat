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
import { Input } from '@/shared/ui/input'
import { Contact, MessageCircle, PanelLeftClose, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { generateUsername } from 'unique-username-generator'

const HomePage = () => {
  const { t, formatUserState } = useI18n()
  const { displayName, keywords, setDisplayName, saveSettings } = useAppStore()
  const { stranger, me, setName: setChatName } = useChat()
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isCompactViewport, setCompactViewport] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const previousState = useRef<UserState | undefined>(me?.state)

  // Welcome form state
  const [welcomeName, setWelcomeName] = useState(() => generateUsername())
  const [welcomeTopics, setWelcomeTopics] = useState('')

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
      setMobileSheetOpen(false)
    }

    if (previousState.current === UserState.Connected && me?.state !== UserState.Connected && !isCompactViewport) {
      setSidebarCollapsed(false)
    }

    previousState.current = me?.state
  }, [isCompactViewport, me?.state])

  const handleWelcomeSubmit = () => {
    const name = welcomeName.trim() || generateUsername()
    const kw = welcomeTopics
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    setDisplayName(name)
    setChatName?.(name)
    saveSettings(kw)
  }

  // Welcome onboarding screen
  if (!displayName) {
    return (
      <div className="flex h-full items-center justify-center px-4">
        <div className="animate-slide-up w-full max-w-md space-y-5 rounded-2xl border border-border/50 bg-card/90 p-6 shadow-xl shadow-black/5 dark:shadow-black/20">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-blue-400/20 text-primary">
              <MessageCircle className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold sm:text-2xl">{t('welcome.title')}</h1>
              <p className="mt-0.5 text-sm text-muted-foreground">{t('welcome.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              value={welcomeName}
              onChange={(e) => setWelcomeName(e.target.value)}
              placeholder={t('welcome.namePlaceholder')}
              className="h-11 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-primary/20"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  handleWelcomeSubmit()
                }
              }}
            />
            <div>
              <Input
                value={welcomeTopics}
                onChange={(e) => setWelcomeTopics(e.target.value)}
                placeholder={t('welcome.topicsPlaceholder')}
                className="h-11 rounded-xl transition-all duration-200 focus:ring-2 focus:ring-primary/20"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    handleWelcomeSubmit()
                  }
                }}
              />
              <p className="mt-2 text-xs text-muted-foreground">{t('welcome.topicsHint')}</p>
            </div>
          </div>

          <Button
            onClick={handleWelcomeSubmit}
            className="h-11 w-full rounded-xl bg-gradient-to-r from-primary to-blue-500 text-sm font-medium shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            {t('welcome.start')}
          </Button>
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <div className="space-y-4 p-3">
      {/* Close button */}
      <div className="flex justify-end">
        {!isCompactViewport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setSidebarCollapsed(true)}
            aria-label="Collapse sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        )}
        {isCompactViewport && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
            onClick={() => setMobileSheetOpen(false)}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Profile section */}
      <div className="rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Contact className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('home.profile')}</h3>
          </div>
          <Badge className="rounded-full text-[10px]">{formatUserState(me?.state)}</Badge>
        </div>
        <p className="mt-3 text-base font-semibold">{me?.name ?? '-'}</p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {keywords.length > 0 ? (
            keywords.map((keyword) => (
              <Badge key={keyword} variant="outline" className="rounded-full text-[11px]">
                {keyword}
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">{t('home.interestsEmpty')}</span>
          )}
        </div>
        <div className="mt-3 text-sm text-muted-foreground">
          <SettingsDialog />
        </div>
      </div>

      {/* Partner section */}
      <div className="rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('home.currentPartner')}</h3>
          </div>
          <Badge variant="outline" className="rounded-full text-[10px]">{formatUserState(stranger?.state)}</Badge>
        </div>
        {stranger ? (
          <div className="animate-fade-in mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold text-white">
              {stranger.name.charAt(0).toUpperCase()}
            </div>
            <p className="text-base font-semibold">{stranger.name}</p>
          </div>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-medium">{t('home.noPartner')}</p>
            <p className="text-xs leading-5 text-muted-foreground">{t('home.noPartnerDescription')}</p>
          </div>
        )}
      </div>
    </div>
  )

  // Mobile: bottom sheet
  if (isCompactViewport) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ChatPanel
            onOpenSidebar={() => setMobileSheetOpen(true)}
            showSidebarToggle
          />
        </div>

        {/* Backdrop */}
        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
            mobileSheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setMobileSheetOpen(false)}
        />

        {/* Bottom sheet */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
            mobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="mx-2 mb-2 max-h-[75vh] overflow-y-auto scroll-touch rounded-2xl bg-card/95 glass ring-1 ring-border/30 safe-area-bottom">
            {/* Drag indicator */}
            <div className="sticky top-0 z-10 flex justify-center bg-card/80 glass pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            {sidebarContent}
          </div>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="flex h-full min-h-0 gap-0">
      {!isSidebarCollapsed && (
        <div className="animate-fade-in w-[300px] shrink-0 border-r border-border/40 overflow-y-auto">
          {sidebarContent}
        </div>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <ChatPanel
          onOpenSidebar={() => setSidebarCollapsed(false)}
          showSidebarToggle={isSidebarCollapsed}
        />
      </div>
    </div>
  )
}

export default HomePage
