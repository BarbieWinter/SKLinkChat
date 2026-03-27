/**
 * Profile settings dialog.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { motion } from 'framer-motion'
import { Settings, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { generateUsername } from 'unique-username-generator'
import { z } from 'zod'

import { useAppStore } from '@/app/store'
import { useAuth } from '@/features/auth/auth-provider'
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
  const { displayName, keywords, me, setName } = useAppStore()
  const [open, setOpen] = useState(false)
  const { setName: setChatName } = useChat()
  const { syncProfile } = useAuth()

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: getSettingsDialogInitialState({ displayName, keywords, meName: me?.name, generateUsername })
  })

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    const interests =
      data.keywords
        ?.split(',')
        .map((keyword) => keyword.trim())
        .filter(Boolean) ?? []

    await syncProfile({
      displayName: data.name,
      interests
    })
    setOpen(false)
    setName(data.name)
    setChatName?.(data.name)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground shadow-sm"
          type="button"
          aria-label={t('settings.trigger')}
        >
          <Settings className="h-4 w-4" />
        </motion.button>
      </DialogTrigger>
      <DialogContent className="rounded-[28px] border-border/60 bg-background/95 backdrop-blur-xl sm:max-w-md">
        <DialogHeader className="gap-2">
          <div className="flex items-center gap-2 text-primary">
            <Sparkles className="h-5 w-5" />
            <DialogTitle className="text-xl font-bold tracking-tight">{t('settings.title')}</DialogTitle>
          </div>
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
                        className="h-12 rounded-2xl border-border/50 bg-muted/30 focus:bg-background transition-all"
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
                        className="h-12 rounded-2xl border-border/50 bg-muted/30 focus:bg-background transition-all"
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
            </div>
            <DialogFooter>
              <Button
                type="submit"
                className="h-11 w-full rounded-2xl bg-gradient-to-r from-primary to-blue-500 font-bold shadow-lg shadow-primary/20"
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
