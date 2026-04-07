/**
 * Profile settings dialog.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { Settings } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { generateUsername } from 'unique-username-generator'
import { z } from 'zod'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
import { useChat } from '@/features/chat/chat-provider'
import { useI18n } from '@/shared/i18n/use-i18n'
import type { Gender } from '@/shared/types'
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
import { Label } from '@/shared/ui/label'

import { getSettingsDialogInitialState } from '@/features/settings/ui/use-settings-dialog-initial-state'

const formSchema = z.object({
  name: z.string().min(1),
  keywords: z.string().optional(),
  gender: z.enum(['male', 'female', 'unknown'])
})

const SettingsDialog = () => {
  const { t } = useI18n()
  const { displayName, keywords, me, setName } = useAppStore()
  const [open, setOpen] = useState(false)
  const { setName: setChatName } = useChat()
  const { authSession, syncProfile } = useAuth()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: getSettingsDialogInitialState({
      displayName,
      keywords,
      gender: authSession.gender,
      meName: me?.name,
      generateUsername
    })
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const interests =
      data.keywords
        ?.split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean) ?? []

    await syncProfile({
      displayName: data.name,
      interests,
      gender: data.gender as Gender
    })
    setOpen(false)
    setName(data.name)
    setChatName?.(data.name)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          type="button"
          aria-label={t('settings.trigger')}
        >
          <Settings className="h-4 w-4" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="gap-2">
          <DialogTitle>{t('settings.title')}</DialogTitle>
          <DialogDescription className="text-start text-sm leading-relaxed">
            {t('settings.description')}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={(e) => {
              e.stopPropagation()
              form.handleSubmit(onSubmit)(e)
            }}
            className="space-y-6 mt-4"
          >
            <div className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={t('settings.namePlaceholder')}
                        className="h-10 rounded-md border-border bg-input terminal-prefix pl-8 focus:border-primary transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormControl>
                      <Input
                        placeholder={t('settings.keywordsPlaceholder')}
                        className="h-10 rounded-md border-border bg-input terminal-prefix pl-8 focus:border-primary transition-all"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="px-1 text-[11px] leading-relaxed">
                      {t('settings.keywordsHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <Label className="px-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      {t('settings.genderLabel')}
                    </Label>
                    <FormControl>
                      <select
                        className="h-10 w-full rounded-md border border-border bg-input px-4 text-sm text-foreground outline-none transition-all focus:border-primary"
                        {...field}
                      >
                        <option value="unknown">{t('settings.genderUnknown')}</option>
                        <option value="male">{t('settings.genderMale')}</option>
                        <option value="female">{t('settings.genderFemale')}</option>
                      </select>
                    </FormControl>
                    <FormDescription className="px-1 text-[11px] leading-relaxed">
                      {t('settings.genderHint')}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="h-10 w-full rounded-md bg-primary text-primary-foreground font-medium hover:shadow-[0_0_24px_hsl(187_72%_48%/0.25)]"
              >
                {t('settings.save')}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default SettingsDialog
