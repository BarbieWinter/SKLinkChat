import { AnimatePresence, motion } from 'framer-motion'
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
    <div className="flex flex-col h-full space-y-4 p-4 overflow-y-auto scrollbar-none">
      <div className="flex items-center justify-between">
        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Users className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold tracking-tight uppercase text-muted-foreground/70">Workspace</span>
        </motion.div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-lg transition-all duration-200 hover:bg-accent active:scale-90"
          onClick={onClose}
        >
          {compact ? <X className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </Button>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Contact className="h-4 w-4" />
            </div>
            <h3 className="text-sm font-semibold">{t('home.profile')}</h3>
          </div>
          <Badge className="rounded-full text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 transition-colors border-none">
            {formatUserState(me?.state)}
          </Badge>
        </div>

        <div className="mt-4 flex flex-col">
          <p className="text-base font-bold text-foreground">{me?.name ?? authSession.display_name ?? '-'}</p>
          <p className="text-xs text-muted-foreground font-medium">
            {authSession.short_id ? `ID: ${authSession.short_id}` : 'ID: -'}
          </p>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {keywords.length > 0 ? (
            keywords.map((keyword, idx) => (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.2 + idx * 0.05 }}
                key={keyword}
              >
                <Badge
                  variant="outline"
                  className="rounded-full text-[11px] border-primary/20 bg-primary/5 text-primary/80"
                >
                  {keyword}
                </Badge>
              </motion.div>
            ))
          ) : (
            <span className="text-xs text-muted-foreground italic">{t('home.interestsEmpty')}</span>
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SettingsDialog />
            {authSession.is_admin && (
              <Link
                to="/admin/reports"
                data-testid="enter-admin-console"
                className="rounded-lg bg-primary/10 px-2.5 py-1.5 text-xs font-bold text-primary transition-all duration-200 hover:bg-primary/20 active:scale-95"
              >
                管理后台
              </Link>
            )}
          </div>
          <button
            type="button"
            className="group flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-bold text-muted-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive active:scale-95"
            onClick={() => void onLogout()}
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>退出</span>
          </button>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl border border-border/50 bg-card/50 p-4 shadow-sm backdrop-blur-sm"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              {stranger ? <Users className="h-4 w-4" /> : <MailCheck className="h-4 w-4" />}
            </div>
            <h3 className="text-sm font-semibold">{t('home.currentPartner')}</h3>
          </div>
          {canReportCurrentPartner && stranger?.id && (
            <ChatReportDialog
              sessionId={sessionId}
              reportedSessionId={stranger.id}
              partnerName={stranger.name}
              partnerShortId={stranger.shortId}
              triggerClassName="h-7 rounded-full border border-destructive/20 bg-destructive/5 px-2.5 py-0 text-[11px] font-bold text-destructive hover:bg-destructive/10 transition-colors"
            />
          )}
        </div>

        <AnimatePresence mode="wait">
          {stranger ? (
            <motion.div
              key="stranger-info"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="mt-4 space-y-1.5"
            >
              <p className="text-xs font-medium leading-5 text-muted-foreground">
                如果对方有出现违规行为请点击举报，我们会严格处理
              </p>
              <p className="text-[11px] font-medium text-muted-foreground">
                {stranger.shortId ? `ID: ${stranger.shortId}` : 'ID: -'}
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="no-partner"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="mt-4 space-y-1.5"
            >
              <p className="text-sm font-bold text-foreground">{t('home.noPartner')}</p>
              <p className="text-xs leading-relaxed text-muted-foreground font-medium">
                {t('home.noPartnerDescription')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
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
    if (typeof window === 'undefined') return

    const syncViewport = () => {
      const compact = window.innerWidth < 1280
      setCompactViewport(compact)
      if (compact) setSidebarCollapsed(true)
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

  return (
    <div className="flex h-full min-h-0 bg-background overflow-hidden">
      <AnimatePresence initial={false}>
        {!isSidebarCollapsed && !isCompactViewport && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 300, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="shrink-0 border-r border-border/40 bg-card/30 backdrop-blur-xl"
          >
            <ChatWorkspaceSidebar compact={false} onClose={() => setSidebarCollapsed(true)} onLogout={logout} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative min-h-0 min-w-0 flex-1">
        <ChatPanel
          onOpenSidebar={() => (isCompactViewport ? setMobileSheetOpen(true) : setSidebarCollapsed(false))}
          showSidebarToggle={isSidebarCollapsed}
        />
      </div>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileSheetOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileSheetOpen(false)}
              className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] overflow-hidden"
            >
              <div className="mx-2 mb-2 h-full flex flex-col rounded-[32px] border border-border/60 bg-background shadow-2xl safe-area-bottom">
                <div className="flex justify-center py-3">
                  <div className="h-1.5 w-12 rounded-full bg-muted-foreground/20" />
                </div>
                <div className="flex-1 overflow-y-auto">
                  <ChatWorkspaceSidebar compact onClose={() => setMobileSheetOpen(false)} onLogout={logout} />
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
