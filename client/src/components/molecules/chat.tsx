/**
 * 聊天主组件：负责展示消息列表、发送消息、输入中提示、滚动定位和局部用户设置入口。
 */
import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { useI18n } from '@/hooks/useI18n'
import { useStore } from '@/lib/store'
import { cn } from '@/lib/utils'
import { useChat } from '@/providers/chat-provider'
import { zodResolver } from '@hookform/resolvers/zod'
import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { Badge } from '../ui/badge'
import { Textarea } from '../ui/textarea'
import { useToast } from '../ui/use-toast'
import SettingsDialog from './settings-dialog'
import UserCount from './user-count'

const formSchema = z.object({
  message: z.string().trim().min(1)
})

const Chat = () => {
  const { t, formatUserState } = useI18n()
  const ref = useRef<HTMLDivElement>(null)
  const { messages, me } = useStore()
  const { sendMessage, stranger, emitTyping: setTyping } = useChat()
  const { toast } = useToast()
  const [meTyping, setMeTyping] = useState(false)

  const debouncedTyping = useRef<NodeJS.Timeout>()

  useEffect(() => {
    // 本地输入状态只保留一个短时间窗口，避免长期停留在“正在输入”。
    if (!meTyping) return
    if (debouncedTyping.current) {
      clearTimeout(debouncedTyping.current)
    }
    debouncedTyping.current = setTimeout(() => {
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
    // When a new message is received, scroll to the bottom of the chat
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
    <div className="flex h-full w-full flex-grow flex-col">
      <div className="flex justify-between gap-2 text-xl">
        <h3>
          {t('chat.log')}: <Badge>{formatUserState(me?.state)}</Badge>
        </h3>
        <UserCount />
      </div>
      <div className="flex h-5/6 flex-grow flex-col gap-4 overflow-y-auto py-8" ref={ref}>
        <span
          className={cn('animate-pulse ease-in-out ', {
            visible: stranger?.isTyping,
            hidden: !stranger?.isTyping
          })}
        >
          {t('chat.strangerTyping')}
        </span>
        {messages.length === 0 && (
          <div className="rounded-md border border-dashed p-6 text-sm text-muted-foreground">
            <p className="font-medium text-foreground">{t('chat.emptyTitle')}</p>
            <p>{t('chat.emptyDescription')}</p>
          </div>
        )}
        {messages.map((message, i) => (
          // 通过 sender 区分“我 / 系统 / 对方”，形成简单的消息展示语义。
          <div key={i} className="flex flex-col gap-2">
            <span
              className={cn('font-bold', {
                'text-accent': message.sender === stranger?.id || message.sender === stranger?.name
              })}
            >
              {message.sender === 'me'
                ? t('chat.you')
                : message.sender === 'system'
                  ? t('chat.system')
                  : message.sender}
              :
            </span>
            <span>{message.message}</span>
          </div>
        ))}
      </div>
      <div className="flex w-full">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className=" flex flex-col md:flex-row gap-4 w-full items-start">
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem className="flex flex-grow flex-col w-full justify-center md:justify-normal">
                  <FormControl>
                    <Textarea
                      rows={4}
                      placeholder={t('chat.placeholder')}
                      {...field}
                      onKeyDown={(e) => {
                        if (!meTyping) {
                          setMeTyping(true)
                          setTyping?.(true)
                        }
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault()
                          form.handleSubmit(onSubmit)()
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription className="">
                    <span className="mr-2">{t('chat.connectedAs', { name: me?.name ?? '-' })}</span>
                    <SettingsDialog />
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" size={'lg'} className="flex gap-2 w-full md:max-w-xs">
              <Send className="w-4 h-4" />
              {t('chat.send')}
            </Button>
          </form>
        </Form>
      </div>
    </div>
  )
}

export default Chat
