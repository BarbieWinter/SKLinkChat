/**
 * Main chat panel UI — Telegram-inspired compact layout.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { Menu, RefreshCw, Send, Sparkles } from 'lucide-react'
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
  const { messages } = useAppStore()
  const { sendMessage, stranger, me, connect, emitTyping: setTyping, isAvailable, isBootstrapping, retryBootstrap } =
    useChat()
  const { toast } = useToast()
  const [meTyping, setMeTyping] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

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
    ref?.current?.scrollTo(0, ref?.current?.scrollHeight)
  }, [messages])

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    if (!isAvailable) {
      toast({
        title: t('common.error'),
        description: t('chat.serviceUnavailable'),
        variant: 'destructive'
      })
      return
    }

    if (isBootstrapping) {
      toast({
        title: t('common.error'),
        description: t('chat.serviceStarting'),
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

    sendMessage?.(data.message.trim())
    form.reset()
    setMeTyping(false)
    setTyping?.(false)
  }

  const isNotConnected = !stranger && me?.state !== UserState.Searching
  const isSearching = me?.state === UserState.Searching
  const isServiceUnavailable = !isAvailable && !isBootstrapping

  const statusText = stranger?.isTyping
    ? t('chat.strangerTyping')
    : stranger
      ? formatUserState(stranger.state)
      : formatUserState(me?.state)

  return (
    <div className="flex h-full w-full flex-col bg-background">
      {/* ── Toolbar ── */}
      <div className="glass flex h-14 shrink-0 items-center gap-2 border-b border-border/40 px-3 sm:px-4">
        {/* Left: sidebar toggle + online count */}
        <div className="flex items-center gap-2.5">
          {showSidebarToggle && (
            <button
              type="button"
              onClick={onOpenSidebar}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:scale-105 active:scale-95"
              aria-label="打开侧栏"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>
          )}
          <OnlineUserCount />
        </div>

        {/* Center: partner name + status */}
        <div className="mx-3 flex min-w-0 flex-1 items-center justify-center">
          {stranger ? (
            <div className="animate-fade-in flex min-w-0 flex-col items-center leading-tight">
              <span className="truncate text-sm font-semibold">{stranger.name}</span>
              <span className={cn(
                'text-[11px] transition-colors duration-300',
                stranger.isTyping ? 'text-primary' : 'text-muted-foreground'
              )}>
                {statusText}
              </span>
            </div>
          ) : (
            <span className={cn(
              'text-xs transition-colors duration-300',
              isSearching ? 'text-primary' : 'text-muted-foreground'
            )}>
              {statusText}
            </span>
          )}
        </div>

        {/* Right: controls */}
        <div className="flex shrink-0 items-center gap-1.5">
          {me?.state === UserState.Connected && (
            <button
              type="button"
              onClick={() => connect?.()}
              className="flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-medium text-primary transition-all duration-200 hover:bg-primary/10 hover:scale-105 active:scale-95"
            >
              <RefreshCw className="h-3 w-3" />
              {t('home.reroll')}
            </button>
          )}
          <ModeToggle />
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="scroll-touch flex flex-1 flex-col gap-1.5 overflow-y-auto px-3 py-3 sm:px-4" ref={ref}>
        {messages.length === 0 && (
          <div className="animate-slide-up m-auto max-w-xs px-4 py-8 text-center">
            <div className="animate-float mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-blue-400/20 text-primary">
              <Sparkles className="h-7 w-7" />
            </div>
            <p className="text-base font-semibold text-foreground">{t('chat.emptyTitle')}</p>
            <p className="mt-1.5 text-sm leading-5 text-muted-foreground">
              {isServiceUnavailable
                ? t('chat.serviceUnavailable')
                : isBootstrapping
                  ? t('chat.serviceStarting')
                  : t('chat.emptyDescription')}
            </p>
            {isServiceUnavailable && (
              <Button
                onClick={() => retryBootstrap?.()}
                variant="outline"
                className="mt-5 h-10 rounded-xl px-8 text-sm font-medium"
              >
                {t('chat.retryConnection')}
              </Button>
            )}
            {isBootstrapping && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <p className="text-sm text-primary">{t('chat.serviceStarting')}</p>
              </div>
            )}
            {isNotConnected && !isServiceUnavailable && !isBootstrapping && (
              <Button
                onClick={() => connect?.()}
                className="mt-5 h-10 rounded-xl bg-gradient-to-r from-primary to-blue-500 px-8 text-sm font-medium shadow-lg shadow-primary/25 transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:scale-105 active:scale-95"
              >
                {t('home.startChat')}
              </Button>
            )}
            {isSearching && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />
                <p className="text-sm text-primary">{t('home.searching')}</p>
              </div>
            )}
          </div>
        )}

        {messages.map((message, i) => {
          const isMe = message.sender === 'me'
          const isSystem = message.sender === 'system'
          const isStranger = !isMe && !isSystem

          const strangerLabel = isStranger
            ? (message.sender === stranger?.id || message.sender === stranger?.name
              ? stranger?.name ?? message.sender
              : message.sender)
            : null

          if (isSystem) {
            return (
              <div key={i} className="animate-message-in flex justify-center py-1.5">
                <span className="rounded-full bg-muted/60 px-3 py-1 text-[11px] text-muted-foreground">
                  {message.message}
                </span>
              </div>
            )
          }

          return (
            <div key={i} className={cn('animate-message-in flex flex-col', isMe ? 'items-end' : 'items-start')}>
              {strangerLabel && (
                <span className="mb-0.5 px-1 text-[11px] font-medium text-primary/80">{strangerLabel}</span>
              )}
              <div
                className={cn(
                  'max-w-[85%] px-3.5 py-2 shadow-sm sm:max-w-[70%]',
                  isMe
                    ? 'rounded-2xl rounded-br-md bg-gradient-to-br from-primary to-blue-500 text-primary-foreground'
                    : 'rounded-2xl rounded-bl-md bg-card text-foreground ring-1 ring-border/50'
                )}
              >
                <p className="whitespace-pre-wrap break-words text-[14px] leading-[1.45]">{message.message}</p>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Input bar ── */}
      <div className="glass shrink-0 border-t border-border/40 px-3 py-2 sm:px-4 safe-area-bottom">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-end gap-2">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="min-w-0 flex-1">
                  <FormControl>
                    <Textarea
                      rows={1}
                      placeholder={t('chat.placeholder')}
                      className="max-h-32 min-h-[40px] resize-none rounded-xl border-border/50 bg-muted/30 px-3.5 py-2.5 text-sm leading-5 transition-all duration-200 focus:border-primary/50 focus:ring-2 focus:ring-primary/20 focus:bg-background"
                      {...field}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      onKeyDown={(e) => {
                        if (!meTyping) {
                          setMeTyping(true)
                          setTyping?.(true)
                        }

                        const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number }
                        const composing = isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229

                        if (e.key === 'Enter' && !e.shiftKey && !composing) {
                          e.preventDefault()
                          form.handleSubmit(onSubmit)()
                        }
                      }}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
            <button
              type="submit"
              disabled={!isAvailable || isBootstrapping}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-r from-primary to-blue-500 text-primary-foreground shadow-md shadow-primary/20 transition-all duration-200 hover:shadow-lg hover:shadow-primary/30 hover:scale-105 active:scale-95"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default ChatPanel
