/**
 * Main chat panel UI.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { CircleEllipsis, MessageSquare, Send, Settings2, ShieldAlert, UserCircle2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'

import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import SettingsDialog from '@/features/settings/ui/settings-dialog'
import { useI18n } from '@/shared/i18n/use-i18n'
import { cn } from '@/shared/lib/utils'
import { Button } from '@/shared/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '@/shared/ui/form'
import { Textarea } from '@/shared/ui/textarea'
import { useToast } from '@/shared/ui/use-toast'

const formSchema = z.object({
  message: z.string().trim().min(1)
})

type MessageTone = {
  alignClassName: string
  rowClassName: string
  bubbleClassName: string
  metaClassName: string
  iconClassName: string
  icon: JSX.Element
  label?: string
  labelKey?: 'chat.you' | 'chat.system'
}

const getMessageTone = (sender: string, strangerName?: string, strangerId?: string): MessageTone => {
  if (sender === 'me') {
    return {
      alignClassName: 'items-end',
      rowClassName: 'flex-row-reverse',
      bubbleClassName: 'border-primary/70 bg-primary text-primary-foreground',
      metaClassName: 'text-primary-foreground/80',
      iconClassName: 'border-primary/70 bg-primary text-primary-foreground',
      icon: <UserCircle2 className="h-4 w-4" />,
      labelKey: 'chat.you' as const
    }
  }

  if (sender === 'system') {
    return {
      alignClassName: 'items-center',
      rowClassName: '',
      bubbleClassName: 'border-border border-dashed bg-muted/70 text-muted-foreground',
      metaClassName: 'text-muted-foreground',
      iconClassName: 'border-border bg-muted text-muted-foreground',
      icon: <ShieldAlert className="h-4 w-4" />,
      labelKey: 'chat.system' as const
    }
  }

  return {
    alignClassName: 'items-start',
    rowClassName: '',
    bubbleClassName: 'border-border bg-card text-card-foreground',
    metaClassName: 'text-muted-foreground',
    iconClassName: 'border-border bg-accent text-accent-foreground',
    icon: <MessageSquare className="h-4 w-4" />,
    label: sender === strangerId || sender === strangerName ? strangerName ?? sender : sender
  }
}

const ChatPanel = () => {
  const { t, formatUserState } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const { messages } = useAppStore()
  const { sendMessage, stranger, emitTyping: setTyping } = useChat()
  const { toast } = useToast()
  const [meTyping, setMeTyping] = useState(false)
  const [isComposing, setIsComposing] = useState(false)

  const debouncedTyping = useRef<number>()

  useEffect(() => {
    // 本地输入状态只保留一个短时间窗口，避免长期停留在“正在输入”。
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
    // 只有存在聊天对象时才允许真正发送消息。
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

  return (
    <div className="flex h-full w-full flex-grow flex-col rounded-[28px] border border-border/80 bg-card/70 p-3 shadow-sm backdrop-blur md:p-4">
      <div className="flex min-h-0 flex-grow flex-col overflow-hidden rounded-[24px] border border-border/70 bg-background/70">
        <div className="flex items-center justify-between border-b border-border/60 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-accent p-2 text-accent-foreground">
              <UserCircle2 className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-medium">{stranger?.name ?? t('home.noPartner')}</p>
              <p className="text-xs text-muted-foreground">{formatUserState(stranger?.state)}</p>
            </div>
          </div>
          <span
            className={cn(
              'inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground transition-opacity',
              {
                'opacity-100': stranger?.isTyping,
                'opacity-0': !stranger?.isTyping
              }
            )}
          >
            <CircleEllipsis className="h-3.5 w-3.5" />
            {t('chat.strangerTyping')}
          </span>
        </div>

        <div className="flex flex-grow flex-col gap-3 overflow-y-auto px-4 py-4" ref={ref}>
          {messages.length === 0 && (
            <div className="mx-auto my-auto max-w-sm rounded-3xl border border-dashed border-border/80 bg-muted/30 px-5 py-6 text-center text-sm text-muted-foreground">
              <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <MessageSquare className="h-5 w-5" />
              </div>
              <p className="font-medium text-foreground">{t('chat.emptyTitle')}</p>
              <p className="mt-2 leading-6">{t('chat.emptyDescription')}</p>
            </div>
          )}

          {messages.map((message, i) => {
            const tone = getMessageTone(message.sender, stranger?.name, stranger?.id)
            const label = tone.labelKey ? t(tone.labelKey) : tone.label
            const isSystem = message.sender === 'system'

            return (
              <div key={i} className={cn('flex flex-col gap-2', tone.alignClassName)}>
                <div
                  className={cn('flex max-w-[85%] items-end gap-3', tone.rowClassName, {
                    'max-w-full items-center justify-center': isSystem
                  })}
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border',
                      tone.iconClassName
                    )}
                  >
                    {tone.icon}
                  </div>
                  <div
                    className={cn(
                      'rounded-[22px] border px-4 py-2.5 shadow-sm',
                      tone.bubbleClassName,
                      isSystem ? 'max-w-2xl text-center' : 'min-w-[180px]'
                    )}
                  >
                    <p className={cn('mb-1 text-xs font-semibold uppercase tracking-[0.18em]', tone.metaClassName)}>
                      {label}
                    </p>
                    <p className="whitespace-pre-wrap break-words text-[15px] leading-6">{message.message}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="mt-3 flex w-full rounded-[24px] border border-border/70 bg-background/80 p-3">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex w-full flex-col items-start gap-3 md:flex-row">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex w-full flex-grow flex-col justify-center md:justify-normal">
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder={t('chat.placeholder')}
                      className="rounded-[20px] border-border/70 bg-muted/30 px-4 py-3 text-[15px] leading-6"
                      {...field}
                      onCompositionStart={() => setIsComposing(true)}
                      onCompositionEnd={() => setIsComposing(false)}
                      onKeyDown={(e) => {
                        if (!meTyping) {
                          setMeTyping(true)
                          setTyping?.(true)
                        }

                        // 输入法组合输入期间，Enter 应该只负责上屏候选词，不直接发送消息。
                        const nativeEvent = e.nativeEvent as KeyboardEvent & { isComposing?: boolean; keyCode?: number }
                        const composing = isComposing || nativeEvent.isComposing || nativeEvent.keyCode === 229

                        if (e.key === 'Enter' && !e.shiftKey && !composing) {
                          e.preventDefault()
                          form.handleSubmit(onSubmit)()
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription className="flex flex-wrap items-center gap-3 text-xs leading-5">
                    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-muted-foreground">
                      <Settings2 className="h-3.5 w-3.5" />
                      {t('chat.connectionHint')}
                    </span>
                    <SettingsDialog />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size="lg" className="h-auto w-full rounded-[20px] px-6 py-4 text-sm md:max-w-[220px]">
              <Send className="mr-2 h-4 w-4" />
              {t('chat.send')}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default ChatPanel
