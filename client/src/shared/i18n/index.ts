/**
 * I18n resources and helpers.
 */
import { UserState } from '@/shared/types'

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
  | 'chat.serviceStarting'
  | 'chat.serviceUnavailable'
  | 'chat.reconnecting'
  | 'chat.retryConnection'
  | 'settings.trigger'
  | 'settings.title'
  | 'settings.description'
  | 'settings.namePlaceholder'
  | 'settings.keywordsPlaceholder'
  | 'settings.keywordsHint'
  | 'settings.genderLabel'
  | 'settings.genderHint'
  | 'settings.genderUnknown'
  | 'settings.genderMale'
  | 'settings.genderFemale'
  | 'settings.save'
  | 'users.online'
  | 'users.unavailable'
  | 'theme.toggle'
  | 'theme.light'
  | 'theme.dark'
  | 'theme.system'
  | 'state.idle'
  | 'state.searching'
  | 'state.connected'
  | 'welcome.title'
  | 'welcome.subtitle'
  | 'welcome.namePlaceholder'
  | 'welcome.topicsPlaceholder'
  | 'welcome.topicsHint'
  | 'welcome.start'
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
    'home.reroll': '重新匹配',
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
    'chat.connectionHint': '可在设置中修改昵称和话题偏好。',
    'chat.serviceStarting': '聊天服务正在连接，请稍后再试。',
    'chat.serviceUnavailable': '聊天服务暂时不可用，请确认后端服务已启动。',
    'chat.reconnecting': '连接已中断，正在恢复聊天连接。',
    'chat.retryConnection': '重新连接',
    'settings.trigger': '编辑资料',
    'settings.title': '个人设置',
    'settings.description': '设置展示给陌生人的昵称和话题偏好。',
    'settings.namePlaceholder': '你希望别人怎么称呼你？',
    'settings.keywordsPlaceholder': '想聊的话题（用逗号分隔）',
    'settings.keywordsHint': '如果什么都愿意聊，可以留空。',
    'settings.genderLabel': '性别标识',
    'settings.genderHint': '用于资料区展示像素小人标识，未设置时显示中性灰色。',
    'settings.genderUnknown': '未设置',
    'settings.genderMale': '男生',
    'settings.genderFemale': '女生',
    'settings.save': '保存更改',
    'users.online': '在线用户',
    'users.unavailable': '在线人数暂不可用',
    'theme.toggle': '切换主题',
    'theme.light': '浅色',
    'theme.dark': '深色',
    'theme.system': '跟随系统',
    'state.idle': '空闲',
    'state.searching': '匹配中',
    'state.connected': '已连接',
    'notFound.title': '页面不存在',
    'notFound.description': '抱歉，发生了未预期的错误。',
    'system.strangerDisconnected': '对方已断开连接',
    'welcome.title': '欢迎来到 SKLink 聊天',
    'welcome.subtitle': '设置你的昵称即可开始，随时可以修改。',
    'welcome.namePlaceholder': '输入一个昵称',
    'welcome.topicsPlaceholder': '想聊的话题（用逗号分隔）',
    'welcome.topicsHint': '可选 — 留空表示什么话题都可以。',
    'welcome.start': '开始使用'
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
