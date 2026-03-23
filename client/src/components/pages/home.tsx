/**
 * 首页：负责展示当前用户信息、聊天对象信息和开始匹配入口，是聊天主工作台。
 */
import { useI18n } from '@/hooks/useI18n'
import { useStore } from '@/lib/store'
import { useChat } from '@/providers/chat-provider'
import { UserState } from '@/types'
import Chat from '../molecules/chat'
import { Badge } from '../ui/badge'
import { Button } from '../ui/button'

const Home = () => {
  const { t, formatUserState } = useI18n()
  const keywords = useStore((state) => state.keywords)
  const { stranger, me, connect } = useChat()

  const buttonLabel =
    me?.state === UserState.Searching
      ? t('home.searching')
      : me?.state === UserState.Connected
        ? t('home.reroll')
        : t('home.startChat')

  return (
    <div className="flex h-full flex-col gap-8 md:flex-row">
      {/* 左侧是匹配与用户资料区域，右侧是聊天主面板。 */}
      <div className="flex w-full flex-col gap-4 md:w-2/5 md:max-w-2xl">
        <div className="rounded-md border border-primary p-6">
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-semibold">{t('home.title')}</h2>
            <p className="text-sm text-muted-foreground">{t('home.description')}</p>
            <Button disabled={me?.state === UserState.Searching} onClick={() => connect?.()}>
              {buttonLabel}
            </Button>
          </div>
        </div>
        <div className="grid gap-4 md:grid-rows-2">
          <div className="rounded-md border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t('home.profile')}</h3>
              <Badge>{formatUserState(me?.state)}</Badge>
            </div>
            <p className="text-sm">
              <span className="font-medium">{me?.name ?? '-'}</span>
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {keywords.length > 0 ? (
                keywords.map((keyword) => (
                  <Badge key={keyword} variant="outline">
                    {keyword}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">{t('home.interestsEmpty')}</span>
              )}
            </div>
          </div>
          <div className="rounded-md border p-4">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="font-semibold">{t('home.currentPartner')}</h3>
              <Badge variant="outline">{formatUserState(stranger?.state)}</Badge>
            </div>
            {stranger ? (
              <p className="text-sm font-medium">{stranger.name}</p>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('home.noPartner')}</p>
                <p className="text-sm text-muted-foreground">{t('home.noPartnerDescription')}</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <Chat />
    </div>
  )
}

export default Home
