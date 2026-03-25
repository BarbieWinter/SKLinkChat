/**
 * 国际化资源中心：维护中英文文案、默认语言判断、模板翻译和用户状态文案映射。
 */
import { UserState } from '@/types'

export type AppLanguage = 'zh-CN'

type TranslationKey =
  | 'app.title'
  | 'common.error'
  | 'common.cancel'
  | 'home.title'
  | 'home.description'
  | 'home.startChat'
  | 'home.searching'
  | 'home.reroll'
  | 'home.profile'
  | 'home.currentPartner'
  | 'home.noPartner'
  | 'home.noPartnerDescription'
  | 'home.interests'
  | 'home.interestsEmpty'
  | 'chat.log'
  | 'chat.system'
  | 'chat.you'
  | 'chat.strangerTyping'
  | 'chat.emptyTitle'
  | 'chat.emptyDescription'
  | 'chat.placeholder'
  | 'chat.connectedAs'
  | 'chat.send'
  | 'chat.notConnected'
  | 'chat.connectionHint'
  | 'settings.trigger'
  | 'settings.title'
  | 'settings.description'
  | 'settings.namePlaceholder'
  | 'settings.keywordsPlaceholder'
  | 'settings.keywordsHint'
  | 'settings.language'
  | 'settings.english'
  | 'settings.chinese'
  | 'settings.save'
  | 'users.online'
  | 'footer.builtBy'
  | 'footer.source'
  | 'theme.toggle'
  | 'theme.light'
  | 'theme.dark'
  | 'theme.system'
  | 'state.idle'
  | 'state.searching'
  | 'state.connected'
  | 'welcome.message'
  | 'notFound.title'
  | 'notFound.description'
  | 'system.strangerDisconnected'

const translations: Record<AppLanguage, Record<TranslationKey, string>> = {
  'zh-CN': {
    'app.title': 'SKLink 聊天',
    'common.error': '错误',
    'common.cancel': '取消',
    'home.title': '纯文本随机聊天',
    'home.description': '立即匹配陌生人，专注于文字交流，不再使用摄像头。',
    'home.startChat': '开始聊天',
    'home.searching': '匹配中...',
    'home.reroll': '下一个陌生人',
    'home.profile': '我的资料',
    'home.currentPartner': '当前聊天对象',
    'home.noPartner': '暂无聊天对象',
    'home.noPartnerDescription': '点击开始匹配，即可连接新的陌生人。',
    'home.interests': '话题偏好',
    'home.interestsEmpty': '未设置话题偏好',
    'chat.log': '聊天记录',
    'chat.system': '系统',
    'chat.you': '我',
    'chat.strangerTyping': '对方正在输入...',
    'chat.emptyTitle': '还没有消息',
    'chat.emptyDescription': '开始匹配后发送第一条消息。',
    'chat.placeholder': '输入你想发送的内容',
    'chat.connectedAs': '你当前使用 {name} 进行聊天。',
    'chat.send': '发送消息',
    'chat.notConnected': '你当前还没有连接到聊天对象。',
    'chat.connectionHint': '可在设置中修改昵称、话题偏好和语言。',
    'settings.trigger': '编辑资料',
    'settings.title': '个人设置',
    'settings.description': '设置展示给陌生人的昵称、话题偏好，以及界面语言。',
    'settings.namePlaceholder': '你希望别人怎么称呼你？',
    'settings.keywordsPlaceholder': '想聊的话题（用逗号分隔）',
    'settings.keywordsHint': '如果什么都愿意聊，可以留空。',
    'settings.language': '语言',
    'settings.english': '英文',
    'settings.chinese': '中文',
    'settings.save': '保存更改',
    'users.online': '在线用户',
    'footer.builtBy': '开发者',
    'footer.source': '源代码',
    'theme.toggle': '切换主题',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'theme.system': '跟随系统',
    'state.idle': '空闲',
    'state.searching': '匹配中',
    'state.connected': '已连接',
    'welcome.message': '欢迎使用 SKLink 聊天',
    'notFound.title': '页面不存在',
    'notFound.description': '抱歉，发生了未预期的错误。',
    'system.strangerDisconnected': '对方已断开连接'
  }
}

export const getDefaultLanguage = (): AppLanguage => 'zh-CN'

export const translate = (language: AppLanguage, key: TranslationKey, values?: Record<string, string | number>) => {
  const template = translations[language][key]

  if (!values) return template

  return Object.entries(values).reduce((result, [name, value]) => {
    return result.split(`{${name}}`).join(String(value))
  }, template)
}

export const getUserStateLabel = (language: AppLanguage, state?: UserState) => {
  if (!state) return translations[language]['state.idle']

  switch (state) {
    case UserState.Searching:
      return translations[language]['state.searching']
    case UserState.Connected:
      return translations[language]['state.connected']
    case UserState.Idle:
    default:
      return translations[language]['state.idle']
  }
}
