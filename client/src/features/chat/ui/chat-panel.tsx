/**
 * Main chat panel UI — Telegram-inspired compact layout.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { AnimatePresence, motion } from 'framer-motion'
import { Menu, RefreshCw, Send, Sparkles, Loader2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { ModeToggle } from '@/app/mode-toggle'
import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import OnlineUserCount from '@/features/presence/ui/online-user-count'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { UserState } from '@/shared/types'
import { Button } from '@/shared/ui/button'
import { Form, FormControl, FormField, FormItem } from '@/shared/ui/form'
import { Textarea } from '@/shared/ui/textarea'
import { useToast } from '@/shared/ui/use-toast'

const formSchema = z.object({
  message: z.string().trim().min(1)
})

type ChatPanelProps = {
  onOpenSidebar?: () => void
  showSidebarToggle?: boolean
}

const ChatPanel = ({ onOpenSidebar, showSidebarToggle }: ChatPanelProps) => {
  const { t, formatUserState } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
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
    availability,
    retryBootstrap
  } = useChat()
  const { toast } = useToast()
  const [meTyping, setMeTyping] = useState(false)
  const [isComposing, setIsComposing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const debouncedTyping = useRef<number>()

  useEffect(() => {
    if (!meTyping) return
    if (debouncedTyping.current) {
      clearTimeout(debouncedTyping.current)
    }
    debouncedTyping.current = window.setTimeout(() => {
      setMeTyping(false)
      setTyping?.(false)
    }, 2000)
  }, [meTyping, setTyping])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: ''
    }
  })

  useEffect(() => {
    if (ref.current) {
      ref.current.scrollTo({
        top: ref.current.scrollHeight,
        behavior: 'smooth'
      })
    }
  }, [messages])

  const scrollToBottom = (behavior: ScrollBehavior = 'smooth') => {
    ref.current?.scrollTo({
      top: ref.current.scrollHeight,
      behavior
    })
  }

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    if (availability === 'error') {
      toast({
        title: t('common.error'),
        description: t('chat.serviceUnavailable'),
        variant: 'destructive'
      })
      return
    }

    if (bootstrapStatus === 'bootstrapping') {
      toast({
        title: t('common.error'),
        description: t('chat.serviceStarting'),
        variant: 'destructive'
      })
      return
    }

    if (transportStatus === 'reconnecting' || transportStatus === 'connecting') {
      toast({
        title: t('common.error'),
        description: t('chat.reconnecting'),
        variant: 'destructive'
      })
      return
    }

    if (!stranger?.id) {
      toast({
        title: t('common.error'),
        description: t('chat.notConnected'),
        variant: 'destructive'
      })
      return
    }

    setIsSubmitting(true)
    try {
      await sendMessage?.(data.message.trim())
      form.reset()
      setMeTyping(false)
      setTyping?.(false)
    } finally {
      setIsSubmitting(false)
    }
  }

  const isNotConnected = !stranger && me?.state !== UserState.Searching
  const isSearching = me?.state === UserState.Searching
  const isBootstrapping = bootstrapStatus === 'bootstrapping'
  const isServiceUnavailable = availability === 'error'
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
      {/* ── Header ── */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="z-20 flex h-14 shrink-0 items-center gap-2 border-b border-border/40 bg-background/80 px-3 backdrop-blur-xl sm:h-16 sm:px-6"
      >
        <div className="flex items-center gap-3">
          {showSidebarToggle && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={onOpenSidebar}
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Menu className="h-5 w-5" />
            </motion.button>
          )}
          <OnlineUserCount />
        </div>

        <div className="mx-2 flex min-w-0 flex-1 items-center justify-center sm:mx-4">
          <AnimatePresence mode="wait">
            <motion.div
              key={stranger?.id ?? 'searching'}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="flex min-w-0 items-center gap-1.5 rounded-full border border-border/50 bg-card/45 px-2.5 py-1.5 shadow-sm backdrop-blur-sm sm:gap-2 sm:px-3"
            >
              <span
                className={cn(
                  'h-2.5 w-2.5 shrink-0 rounded-full transition-colors',
                  stranger?.isTyping || isSearching
                    ? 'bg-primary shadow-[0_0_0_4px_rgba(14,165,233,0.12)]'
                    : stranger
                      ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(74,222,128,0.12)]'
                      : 'bg-slate-400/70'
                )}
              />
              <span className="truncate text-[13px] font-semibold tracking-tight text-foreground sm:text-sm">
                {headerTitle}
              </span>
              <span
                className={cn(
                  'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors duration-300 sm:text-[11px]',
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

        <div className="flex shrink-0 items-center gap-2">
          {me?.state === UserState.Connected && (
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => connect?.()}
              className="flex items-center gap-1.5 rounded-2xl bg-primary/10 px-4 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/20"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t('home.reroll')}</span>
            </motion.button>
          )}
          <ModeToggle />
        </div>
      </motion.div>

      {/* ── Messages Area ── */}
      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0 scroll-touch overflow-y-auto px-3 py-3 sm:px-6 sm:py-6 space-y-3 sm:space-y-4" ref={ref}>
          <AnimatePresence>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="mx-auto flex min-h-full max-w-sm flex-col items-center justify-start pt-8 text-center sm:justify-center sm:pt-0"
              >
                <motion.div
                  animate={{
                    y: [0, -10, 0],
                    rotate: [0, 5, -5, 0]
                  }}
                  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                  className="mb-5 flex h-16 w-16 items-center justify-center rounded-[28px] bg-gradient-to-br from-primary/20 via-blue-500/20 to-cyan-400/20 text-primary shadow-inner sm:mb-6 sm:h-20 sm:w-20 sm:rounded-[32px]"
                >
                  <Sparkles className="h-8 w-8 sm:h-10 sm:w-10" />
                </motion.div>

                <h3 className="text-lg font-bold tracking-tight text-foreground sm:text-xl">{t('chat.emptyTitle')}</h3>
                <p className="mt-2 max-w-[28ch] text-[13px] leading-relaxed text-muted-foreground sm:max-w-none sm:text-sm">
                  {isServiceUnavailable
                    ? t('chat.serviceUnavailable')
                    : isReconnecting
                      ? t('chat.reconnecting')
                      : isBootstrapping
                        ? t('chat.serviceStarting')
                        : isSearching
                          ? '正在为你匹配有趣的灵魂...'
                          : t('chat.emptyDescription')}
                </p>

                {isSearching && (
                  <div className="mt-8 flex gap-1.5">
                    {[0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        animate={{ scale: [1, 1.5, 1], opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                        className="h-2 w-2 rounded-full bg-primary"
                      />
                    ))}
                  </div>
                )}

                {!isSearching && isNotConnected && !isServiceUnavailable && !isBootstrapping && (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="mt-6 w-full sm:mt-8">
                    <Button
                      onClick={() => connect?.()}
                      className="h-11 w-full rounded-2xl bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-[15px] font-bold shadow-lg shadow-primary/20 sm:h-12"
                    >
                      {t('home.startChat')}
                    </Button>
                  </motion.div>
                )}

                {isServiceUnavailable && (
                  <Button
                    onClick={() => retryBootstrap?.()}
                    variant="outline"
                    className="mt-8 rounded-2xl border-primary/20"
                  >
                    {t('chat.retryConnection')}
                  </Button>
                )}
              </motion.div>
            )}

            {messages.map((message, i) => {
              const isMe = message.sender === 'me'
              const isSystem = message.sender === 'system'
              const isStranger = !isMe && !isSystem

              if (isSystem) {
                return (
                  <motion.div
                    key={`sys-${i}`}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-center"
                  >
                    <span className="rounded-full bg-muted/50 px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground/80 backdrop-blur-sm ring-1 ring-border/20">
                      {message.message}
                    </span>
                  </motion.div>
                )
              }

              return (
                <motion.div
                  key={`msg-${i}`}
                  initial={{ opacity: 0, scale: 0.9, x: isMe ? 20 : -20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  className={cn('flex flex-col', isMe ? 'items-end' : 'items-start')}
                >
                  {!isMe && isStranger && (
                    <span className="mb-1 ml-1 text-[11px] font-bold text-primary/70 uppercase tracking-tight">
                      {stranger?.name ?? message.sender}
                    </span>
                  )}
                  <div
                    className={cn(
                      'relative max-w-[88%] px-3.5 py-2.5 shadow-md sm:max-w-[70%] sm:px-4 sm:py-3',
                      isMe
                        ? 'rounded-3xl rounded-br-lg bg-gradient-to-br from-primary via-blue-600 to-cyan-500 text-primary-foreground shadow-primary/10'
                        : 'rounded-3xl rounded-bl-lg bg-card text-foreground ring-1 ring-border/40 backdrop-blur-xl'
                    )}
                  >
                    <p className="whitespace-pre-wrap break-words text-[14px] leading-relaxed sm:text-[15px]">
                      {message.message}
                    </p>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      </div>

      {/* ── Input bar ── */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="z-20 border-t border-border/40 bg-background/80 px-3 py-2.5 backdrop-blur-xl sm:px-6 sm:py-3 safe-area-bottom"
      >
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="mx-auto flex max-w-4xl items-end gap-2 sm:gap-3">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => {
                const { ref: fieldRef, ...fieldProps } = field

                return (
                  <FormItem className="min-w-0 flex-1">
                    <FormControl>
                      <div className="relative">
                        <Textarea
                          ref={(node) => {
                            fieldRef(node)
                            composerRef.current = node
                          }}
                          rows={1}
                          placeholder={t('chat.placeholder')}
                          className="max-h-28 min-h-[44px] resize-none rounded-2xl border-border/50 bg-muted/30 px-3.5 py-3 text-[14px] leading-5 transition-all duration-300 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 focus:bg-background sm:max-h-32 sm:min-h-[48px] sm:px-4 sm:py-3.5 sm:text-[15px]"
                          {...fieldProps}
                          onCompositionStart={() => setIsComposing(true)}
                          onCompositionEnd={() => setIsComposing(false)}
                          onFocus={() => {
                            scrollToBottom('auto')
                            window.setTimeout(() => scrollToBottom('auto'), 280)
                          }}
                          onKeyDown={(e) => {
                            if (!meTyping) {
                              setMeTyping(true)
                              setTyping?.(true)
                            }
                            const composing = isComposing || e.nativeEvent.isComposing
                            if (e.key === 'Enter' && !e.shiftKey && !composing) {
                              e.preventDefault()
                              form.handleSubmit(onSubmit)()
                            }
                          }}
                        />
                      </div>
                    </FormControl>
                  </FormItem>
                )
              }}
            />
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button
                type="submit"
                disabled={isComposerDisabled || isSubmitting}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-r from-primary via-blue-500 to-cyan-500 text-primary-foreground shadow-lg shadow-primary/20 transition-all disabled:opacity-50 sm:h-12 sm:w-12"
              >
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
              </Button>
            </motion.div>
          </form>
        </Form>
      </motion.div>
    </div>
  )
}

export default ChatPanel
