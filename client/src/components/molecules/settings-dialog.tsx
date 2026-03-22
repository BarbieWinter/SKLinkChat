import { useI18n } from '@/hooks/useI18n'
import { AppLanguage } from '@/lib/i18n'
import { useStore } from '@/lib/store'
import { useChat } from '@/providers/chat-provider'
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { generateUsername } from 'unique-username-generator'
import { z } from 'zod'
import { Button } from '../ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '../ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '../ui/form'
import { Input } from '../ui/input'

const formSchema = z.object({
  name: z.string().min(1),
  keywords: z.string().optional(),
  language: z.enum(['en', 'zh-CN'])
})

const SettingsDialog = () => {
  const { t } = useI18n()
  const { keywords, saveSettings, me, setName, language, setLanguage } = useStore()
  const [open, setOpen] = useState(!me?.name)
  const { setName: setChatName } = useChat()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: me?.name || generateUsername(),
      keywords: keywords?.join(', ') || '',
      language
    }
  })

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    setOpen(false)
    saveSettings(data.keywords?.split(',').map((keyword) => keyword.trim()).filter(Boolean) ?? [])
    setName(data.name)
    setLanguage(data.language as AppLanguage)
    setChatName?.(data.name)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="text-sm hover:underline" type="button">
          ({t('settings.trigger')})
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader className="gap-4">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="text-start text-sm">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation()
              form.handleSubmit(onSubmit)(e)
            }}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormControl>
                    <Input placeholder={t('settings.namePlaceholder')} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="keywords"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormControl>
                    <Input placeholder={t('settings.keywordsPlaceholder')} {...field} />
                  </FormControl>
                  <FormDescription>{t('settings.keywordsHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="language"
              render={({ field }) => (
                <FormItem className="flex-grow">
                  <FormDescription className="mb-2 text-foreground">{t('settings.language')}</FormDescription>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant={field.value === 'en' ? 'default' : 'outline'}
                      onClick={() => field.onChange('en')}
                    >
                      {t('settings.english')}
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'zh-CN' ? 'default' : 'outline'}
                      onClick={() => field.onChange('zh-CN')}
                    >
                      {t('settings.chinese')}
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="submit">{t('settings.save')}</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
