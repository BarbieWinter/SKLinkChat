/**
 * Main chat panel UI — mobile-first layout with keyboard-aware composer.
 *
 * Layout: flex-col with three zones:
 *   1. Header (shrink-0, fixed height)
 *   2. Messages (flex-1, scrollable)
 *   3. Composer (shrink-0, auto-height textarea + safe area)
 *
 * The composer is NOT position:fixed — it sits naturally at the bottom of
 * the flex column. When the mobile keyboard opens, the browser shrinks the
 * visual viewport and the flex layout adapts automatically. We use
 * `useVisualViewport` to detect keyboard state and apply the viewport
 * height to the outer container so iOS Safari doesn't miscalculate.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, RefreshCw, Send, Loader2 } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ModeToggle } from '@/app/mode-toggle'
import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import { useVisualViewport } from '@/features/chat/hooks/use-visual-viewport'
import { getAnonymousPartnerLabel } from '@/features/chat/model/identity'
import { VirtualMessageList } from '@/features/chat/ui/virtual-message-list'
import OnlineUserCount from '@/features/presence/ui/online-user-count'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { PixelGenderIcon } from '@/shared/ui/pixel-gender-icon'

const formSchema = z.object({
  message: z.string().trim().min(1)
})

/** Max textarea lines before scrolling */
const MAX_TEXTAREA_LINES = 5
const LINE_HEIGHT = 20 // leading-5 = 20px
const TEXTAREA_PADDING_Y = 24 // py-3 = 12px * 2
const MIN_COMPOSER_HEIGHT = 44
const MAX_COMPOSER_HEIGHT = MAX_TEXTAREA_LINES * LINE_HEIGHT + TEXTAREA_PADDING_Y

type ChatPanelProps = {
  onOpenSidebar?: () => void
  showSidebarToggle?: boolean
}

const ChatPanel = ({ onOpenSidebar, showSidebarToggle }: ChatPanelProps) => {
  const { t, formatUserState } = useI18n()
  const messagesContainerRef = useRef<HTMLDivElement | null>(null)
  const composerRef = useRef<HTMLTextAreaElement | null>(null)
  const { messages } = useAppStore()
  const {
    sendMessage,
    stranger,
    me,
    connect,
    emitTyping: setTyping,
    bootstrapStatus,
    transportStatus,
    availability
  } = useChat()

  const [meTyping, setMeTyping] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [containerWidth, setContainerWidth] = useState(0)
  const { keyboardOpen } = useVisualViewport()

  const debouncedTyping = useRef<number>()

  // Track message area width for pretext bubble measurement
  const measureContainer = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    messagesContainerRef.current = node
    setContainerWidth(node.clientWidth)
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      setContainerWidth(entries[0]?.contentRect.width ?? 0)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!meTyping) return
    if (debouncedTyping.current) clearTimeout(debouncedTyping.current)
    debouncedTyping.current = window.setTimeout(() => {
      setMeTyping(false)
      setTyping?.(false)
    }, 2000)
  }, [meTyping, setTyping])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { message: '' }
  })

  // ── Textarea auto-height (DOM-based, simple & reliable on all platforms) ──
  const adjustTextareaHeight = useCallback(() => {
    const el = composerRef.current
    if (!el) return
    // Reset to single-line height to get accurate scrollHeight
    el.style.height = `${MIN_COMPOSER_HEIGHT}px`
    if (el.value) {
      const scrollH = el.scrollHeight
      const clamped = Math.min(scrollH, MAX_COMPOSER_HEIGHT)
      el.style.height = `${clamped}px`
      el.style.overflowY = scrollH > MAX_COMPOSER_HEIGHT ? 'auto' : 'hidden'
    } else {
      el.style.overflowY = 'hidden'
    }
  }, [])

  const messageText = form.watch('message')

  useEffect(() => {
    adjustTextareaHeight()
  }, [messageText, adjustTextareaHeight])

  // ── When keyboard opens on mobile, scroll messages to bottom ──
  useEffect(() => {
    if (!keyboardOpen) return
    // Small delay to let the viewport settle after keyboard animation
    setTimeout(() => {
      // Scroll the message list to the bottom so user sees latest messages
      const msgContainer = messagesContainerRef.current
      if (msgContainer) {
        const scrollable = msgContainer.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null
        if (scrollable) {
          scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: 'smooth' })
        }
      }
    }, 150)
  }, [keyboardOpen])

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (availability === 'error' || bootstrapStatus === 'bootstrapping') return
    if (transportStatus === 'reconnecting' || transportStatus === 'connecting') return
    if (!stranger?.id) return

    setIsSubmitting(true)
    try {
      await sendMessage?.(data.message.trim())
      form.reset()
      setMeTyping(false)
      setTyping?.(false)
      // Reset textarea height after clearing
      requestAnimationFrame(() => {
        if (composerRef.current) {
          composerRef.current.style.height = `${MIN_COMPOSER_HEIGHT}px`
        }
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const isSearching = me?.state === UserState.Searching
  const isReconnecting = transportStatus === 'reconnecting'
  const isComposerDisabled =
    availability !== 'ready' || transportStatus !== 'connected' || !stranger?.id || me?.state !== UserState.Connected

  const headerTitle = stranger ? getAnonymousPartnerLabel(stranger.gender) : isSearching ? t('home.searching') : t('chat.notConnected')
  const statusText = stranger?.isTyping
    ? t('chat.strangerTyping')
    : isReconnecting
      ? t('chat.reconnecting')
      : stranger
        ? formatUserState(stranger.state)
        : formatUserState(me?.state)

  return (
    <div className="pixel-chat-shell flex h-full w-full flex-col selection:bg-primary/20">
      {/* ── Header ── */}
      <div className="pixel-chat-header z-20 flex h-14 shrink-0 items-center gap-2 border-b-[3px] border-[#1a1a1a] px-3 sm:px-6">
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="pixel-toolbar-button flex h-9 w-9 items-center justify-center text-muted-foreground transition-colors"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          )}
          <OnlineUserCount className="pixel-toolbar-chip px-2.5 py-1.5" />
        </div>

        <div className="mx-2 flex min-w-0 flex-1 items-center justify-center sm:mx-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={stranger?.id ?? 'idle'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex min-w-0 items-center"
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 border-2 border-[#1a1a1a] transition-colors',
                  stranger?.isTyping || isSearching ? 'bg-primary' : stranger ? 'bg-amber' : 'bg-muted-foreground/40'
                )}
              />
              {stranger && <PixelGenderIcon gender={stranger.gender ?? 'unknown'} size={16} className="ml-2 shrink-0" />}
              <span className="pixel-chat-title ml-2 truncate text-[12px] text-foreground sm:text-[13px]">
                {headerTitle}
              </span>
              <span className="mx-2 text-[#8b5b70]">/</span>
              <span className="pixel-chat-status shrink-0 text-[10px] text-muted-foreground sm:text-[11px]">
                {statusText}
              </span>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {me?.state === UserState.Connected && (
            <button
              type="button"
              onClick={() => connect?.()}
              className="pixel-toolbar-button flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-foreground transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('home.reroll')}</span>
            </button>
          )}
          <ModeToggle className="pixel-toolbar-button" />
        </div>
      </div>

      {/* ── Messages Area ── */}
      <div className="pixel-chat-stage relative flex-1 min-h-0 overflow-hidden" ref={measureContainer}>
        <VirtualMessageList messages={messages} containerWidth={containerWidth} />
      </div>

      {/* ── Composer ── */}
      <div
        className={cn(
          'pixel-chat-composer z-20 shrink-0 border-t-[3px] border-[#1a1a1a]',
          // Only apply safe-area padding when keyboard is NOT open
          !keyboardOpen && 'pb-[env(safe-area-inset-bottom)]'
        )}
      >
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="mx-auto flex max-w-3xl items-end gap-2 px-3 py-2 sm:px-4 sm:py-2.5"
        >
          <div className="min-w-0 flex-1">
            <textarea
              ref={(node) => {
                form.register('message').ref(node)
                composerRef.current = node
              }}
              placeholder="输入消息..."
              disabled={isComposerDisabled}
              className={cn(
                'pixel-chat-input terminal-prefix w-full resize-none pl-8 pr-3.5 py-3 text-[14px] leading-5 outline-none transition-colors sm:text-[15px]',
                'focus:border-primary focus:ring-0',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'sm:pr-4'
              )}
              style={{
                height: `${MIN_COMPOSER_HEIGHT}px`,
                maxHeight: `${MAX_COMPOSER_HEIGHT}px`,
                overflowY: 'hidden'
              }}
              value={form.watch('message')}
              onChange={(e) => {
                form.setValue('message', e.target.value, { shouldValidate: false })
                if (!meTyping) {
                  setMeTyping(true)
                  setTyping?.(true)
                }
              }}
              onCompositionStart={() => setIsComposing(true)}
              onCompositionEnd={() => setIsComposing(false)}
              onKeyDown={(e) => {
                const composing = isComposing || e.nativeEvent.isComposing
                if (e.key === 'Enter' && !e.shiftKey && !composing) {
                  e.preventDefault()
                  form.handleSubmit(onSubmit)()
                }
              }}
            />
          </div>
          <Button
            type="submit"
            disabled={isComposerDisabled || isSubmitting || !form.watch('message')?.trim()}
            className={cn(
              'pixel-send-button flex h-11 w-11 shrink-0 items-center justify-center transition-all',
              'disabled:opacity-40',
              'active:scale-100'
            )}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default ChatPanel
