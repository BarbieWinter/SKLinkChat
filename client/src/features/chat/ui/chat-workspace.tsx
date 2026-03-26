import { Contact, LogOut, MailCheck, PanelLeftClose, Users, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { useChat } from '@/features/chat/chat-provider'
import ChatPanel from '@/features/chat/ui/chat-panel'
import ChatReportDialog from '@/features/chat/ui/chat-report-dialog'
import SettingsDialog from '@/features/settings/ui/settings-dialog'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'

const ChatWorkspaceSidebar = ({
  compact,
  onClose,
  onLogout
}: {
  compact: boolean
  onClose: () => void
  onLogout: () => Promise<void>
}) => {
  const { t, formatUserState } = useI18n()
  const { keywords } = useAppStore()
  const { authSession } = useAuth()
  const { stranger, me, sessionId, availability, bootstrapStatus, transportStatus } = useChat()
  const canReportCurrentPartner =
    availability === 'ready' &&
    bootstrapStatus === 'ready' &&
    transportStatus === 'connected' &&
    me?.state === UserState.Connected &&
    Boolean(stranger?.id)
  return (
    <div className="space-y-4 p-3">
      <div className="flex justify-end">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg transition-all duration-200 hover:scale-105 active:scale-95"
          onClick={onClose}
          aria-label={compact ? 'Close panel' : 'Collapse sidebar'}
        >
          {compact ? <X className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

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
        <p className="mt-3 text-base font-semibold">{me?.name ?? authSession.display_name ?? '-'}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {authSession.short_id ? `ID: ${authSession.short_id}` : 'ID: -'}
        </p>
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
        <div className="mt-3 flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-3">
            <SettingsDialog />
            {authSession.is_admin ? (
              <Link
                to="/admin/reports"
                data-testid="enter-admin-console"
                className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-sm font-medium text-primary transition-all duration-200 hover:bg-primary/15 active:scale-95"
              >
                进入管理后台
              </Link>
            ) : null}
          </div>
          <button
            type="button"
            className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-95"
            onClick={() => {
              void onLogout()
            }}
          >
            <LogOut className="h-3.5 w-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" />
            <span>退出登录</span>
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-muted/30 p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {stranger ? <Users className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
            </div>
            <h3 className="text-sm font-semibold">{t('home.currentPartner')}</h3>
          </div>
          <div className="flex items-center gap-2">
            {canReportCurrentPartner && stranger?.id && (
              <ChatReportDialog
                sessionId={sessionId}
                reportedSessionId={stranger.id}
                partnerName={stranger.name}
                partnerShortId={stranger.shortId}
                triggerClassName="h-7 rounded-full border border-destructive/20 bg-destructive/5 px-2.5 py-0 text-[11px] hover:bg-destructive/10"
              />
            )}
            <Badge variant="outline" className="rounded-full text-[10px]">
              {formatUserState(stranger?.state)}
            </Badge>
          </div>
        </div>
        {stranger ? (
          <div className="animate-fade-in mt-3 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-primary to-blue-500 text-xs font-bold text-white">
              {stranger.name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="text-base font-semibold">{stranger.name}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {stranger.shortId ? `ID: ${stranger.shortId}` : 'ID: -'}
              </p>
            </div>
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
}

export const ChatWorkspace = () => {
  const { logout } = useAuth()
  const { me } = useChat()
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [isCompactViewport, setCompactViewport] = useState(false)
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false)
  const previousState = useRef<UserState | undefined>(me?.state)

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }

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

  if (isCompactViewport) {
    return (
      <div className="flex h-full min-h-0 flex-col">
        <div className="min-h-0 flex-1">
          <ChatPanel onOpenSidebar={() => setMobileSheetOpen(true)} showSidebarToggle />
        </div>

        <div
          className={cn(
            'fixed inset-0 z-40 bg-black/50 transition-opacity duration-300',
            mobileSheetOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          )}
          onClick={() => setMobileSheetOpen(false)}
        />

        <div
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 transform transition-transform duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]',
            mobileSheetOpen ? 'translate-y-0' : 'translate-y-full'
          )}
        >
          <div className="mx-2 mb-2 max-h-[75vh] overflow-y-auto scroll-touch rounded-2xl bg-card/95 glass ring-1 ring-border/30 safe-area-bottom">
            <div className="sticky top-0 z-10 flex justify-center bg-card/80 glass pb-1 pt-3">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/25" />
            </div>
            <ChatWorkspaceSidebar compact onClose={() => setMobileSheetOpen(false)} onLogout={logout} />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 gap-0">
      {!isSidebarCollapsed && (
        <div className="animate-fade-in w-[300px] shrink-0 overflow-y-auto border-r border-border/40">
          <ChatWorkspaceSidebar compact={false} onClose={() => setSidebarCollapsed(true)} onLogout={logout} />
        </div>
      )}
      <div className="min-h-0 min-w-0 flex-1">
        <ChatPanel onOpenSidebar={() => setSidebarCollapsed(false)} showSidebarToggle={isSidebarCollapsed} />
      </div>
    </div>
  )
}
