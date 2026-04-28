/**
 * Main chat panel UI — mobile-first layout with keyboard-aware composer.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2, Menu, RefreshCw, Send } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ModeToggle } from '@/app/mode-toggle'
import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import { useVisualViewport } from '@/features/chat/hooks/use-visual-viewport'
import { VirtualMessageListClassic } from '@/features/chat/ui/virtual-message-list-classic'
import OnlineUserCount from '@/features/presence/ui/online-user-count'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Button } from '@/shared/ui/button'

const formSchema = z.object({
  message: z.string().trim().min(1)
})

const MAX_TEXTAREA_LINES = 5
const LINE_HEIGHT = 20
const TEXTAREA_PADDING_Y = 24
const MIN_COMPOSER_HEIGHT = 44
const MAX_COMPOSER_HEIGHT = MAX_TEXTAREA_LINES * LINE_HEIGHT + TEXTAREA_PADDING_Y

type ChatPanelClassicProps = {
  onOpenSidebar?: () => void
  showSidebarToggle?: boolean
}

const ChatPanelClassic = ({ onOpenSidebar, showSidebarToggle }: ChatPanelClassicProps) => {
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

  const adjustTextareaHeight = useCallback(() => {
    const el = composerRef.current
    if (!el) return
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

  useEffect(() => {
    if (!keyboardOpen) return
    setTimeout(() => {
      const msgContainer = messagesContainerRef.current
      if (!msgContainer) return
      const scrollable = msgContainer.querySelector('[class*="overflow-y-auto"]') as HTMLElement | null
      if (scrollable) {
        scrollable.scrollTo({ top: scrollable.scrollHeight, behavior: 'smooth' })
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

  const headerTitle = stranger ? stranger.name : isSearching ? t('home.searching') : t('chat.notConnected')
  const statusText = stranger?.isTyping
    ? t('chat.strangerTyping')
    : isReconnecting
      ? t('chat.reconnecting')
      : stranger
        ? formatUserState(stranger.state)
        : formatUserState(me?.state)

  return (
    <div className="flex h-full w-full flex-col bg-background selection:bg-primary/20">
      <div className="z-20 flex h-12 shrink-0 items-center gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur-xl sm:h-14 sm:px-6">
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted/50 text-muted-foreground transition-colors active:scale-95 hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-4.5 w-4.5" />
            </button>
          )}
          <OnlineUserCount />
        </div>

        <div className="mx-2 flex min-w-0 flex-1 items-center justify-center sm:mx-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={stranger?.id ?? 'idle'}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/50 bg-card/45 px-2.5 py-1 shadow-sm backdrop-blur-sm sm:gap-2 sm:px-3"
            >
              <span
                className={cn(
                  'h-2 w-2 shrink-0 rounded-full transition-colors',
                  stranger?.isTyping || isSearching
                    ? 'bg-primary shadow-[0_0_0_3px_rgba(14,165,233,0.12)]'
                    : stranger
                      ? 'bg-emerald-400 shadow-[0_0_0_3px_rgba(74,222,128,0.12)]'
                      : 'bg-slate-400/70'
                )}
              />
              <span className="truncate text-[13px] font-semibold tracking-tight text-foreground">{headerTitle}</span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium transition-colors',
                  stranger?.isTyping || isSearching
                    ? 'bg-primary/10 text-primary'
                    : stranger
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                )}
              >
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
              className="flex items-center gap-1 rounded-xl bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary transition-colors active:scale-95 hover:bg-primary/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('home.reroll')}</span>
            </button>
          )}
          <ModeToggle />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden" ref={measureContainer}>
        <VirtualMessageListClassic messages={messages} containerWidth={containerWidth} />
      </div>

      <div
        className={cn(
          'z-20 shrink-0 border-t border-border/40 bg-background/95 backdrop-blur-xl',
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
                'w-full resize-none rounded-2xl border border-border/50 bg-muted/30 px-3.5 py-3 text-[15px] leading-5 outline-none transition-colors',
                'placeholder:text-muted-foreground/60',
                'focus:border-primary/40 focus:bg-background focus:ring-2 focus:ring-primary/10',
                'disabled:cursor-not-allowed disabled:opacity-50',
                'sm:px-4'
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
              'flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all',
              'bg-primary text-primary-foreground shadow-md',
              'disabled:opacity-40 disabled:shadow-none',
              'active:scale-95'
            )}
          >
            {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
          </Button>
        </form>
      </div>
    </div>
  )
}

export default ChatPanelClassic
