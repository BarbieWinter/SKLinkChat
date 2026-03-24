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
      <div className="flex h-full items-center justify-center">
        <div className="w-full max-w-md space-y-6 rounded-[28px] border border-border/70 bg-card/80 p-8 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-primary/10 p-3 text-primary">
              <MessageCircle className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t('welcome.title')}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{t('welcome.subtitle')}</p>
            </div>
          </div>

          <div className="space-y-4">
            <Input
              value={welcomeName}
              onChange={(e) => setWelcomeName(e.target.value)}
              placeholder={t('welcome.namePlaceholder')}
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

          <Button onClick={handleWelcomeSubmit} className="h-12 w-full rounded-2xl text-sm">
            {t('welcome.start')}
          </Button>
        </div>
      </div>
    )
  }

  const sidebarContent = (
    <div className="space-y-4 rounded-[28px] border border-border/70 bg-card/80 p-5 shadow-sm">
      {/* Close button */}
      <div className="flex justify-end">
        {!isCompactViewport && (
          <Button
            variant="ghost"
            size="icon"
            className="rounded-2xl border border-border/70"
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
            className="rounded-2xl border border-border/70"
            onClick={() => setMobileSheetOpen(false)}
            aria-label="Close panel"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Profile section */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-muted p-2 text-muted-foreground">
              <Contact className="h-4 w-4" />
            </div>
            <h3 className="font-semibold">{t('home.profile')}</h3>
          </div>
          <Badge>{formatUserState(me?.state)}</Badge>
        </div>
        <p className="mt-3 text-base font-semibold">{me?.name ?? '-'}</p>
        <div className="mt-3 flex flex-wrap gap-2">
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
        <div className="mt-3 text-sm text-muted-foreground">
          <SettingsDialog />
        </div>
      </div>

      {/* Divider */}
      <div className="border-t border-border/40" />

      {/* Partner section — flat, no nested card */}
      <div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-2xl bg-muted p-2 text-muted-foreground">
              <Users className="h-4 w-4" />
            </div>
            <h3 className="font-semibold">{t('home.currentPartner')}</h3>
          </div>
          <Badge variant="outline">{formatUserState(stranger?.state)}</Badge>
        </div>
        {stranger ? (
          <p className="mt-3 text-base font-semibold">{stranger.name}</p>
        ) : (
          <div className="mt-3 space-y-1">
            <p className="text-sm font-medium">{t('home.noPartner')}</p>
            <p className="text-sm leading-6 text-muted-foreground">{t('home.noPartnerDescription')}</p>
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
        {mobileSheetOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 transition-opacity"
            onClick={() => setMobileSheetOpen(false)}
          />
        )}

        {/* Bottom sheet */}
        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 ease-in-out',
            mobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="mx-2 mb-2 max-h-[75vh] overflow-y-auto">
            {/* Drag indicator */}
            <div className="flex justify-center pb-2 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>
            {sidebarContent}
          </div>
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="flex h-full min-h-0 gap-4">
      {!isSidebarCollapsed && (
        <div className="w-[326px] shrink-0">
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
