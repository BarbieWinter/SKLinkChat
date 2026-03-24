/**
 * Profile settings dialog.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { generateUsername } from 'unique-username-generator'
import { z } from 'zod'

import { useAppStore } from '@/app/store'
import { useChat } from '@/features/chat/chat-provider'
import { useI18n } from '@/shared/i18n/use-i18n'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/shared/ui/dialog'
import { Form, FormControl, FormDescription, FormField, FormItem, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { getSettingsDialogInitialState } from '@/features/settings/ui/use-settings-dialog-initial-state'

const formSchema = z.object({
  name: z.string().min(1),
  keywords: z.string().optional()
})

const SettingsDialog = () => {
  const { t } = useI18n()
  const { displayName, keywords, saveSettings, me, setName, setDisplayName } = useAppStore()
  const [open, setOpen] = useState(false)
  const { setName: setChatName } = useChat()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: getSettingsDialogInitialState({ displayName, keywords, meName: me?.name, generateUsername })
  })

  const onSubmit = (data: z.infer<typeof formSchema>) => {
    // 设置保存后会同时更新本地状态和服务端昵称，保证展示与通信一致。
    setOpen(false)
    saveSettings(
      data.keywords
        ?.split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean) ?? []
    )
    setDisplayName(data.name)
    setName(data.name)
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
          <DialogDescription className="text-start text-sm">{t('settings.description')}</DialogDescription>
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
