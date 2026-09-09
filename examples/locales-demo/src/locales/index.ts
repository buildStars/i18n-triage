// i18n 初始化文件：文件名不是语言代码，语言包发现会跳过它
import { createI18n } from 'vue-i18n'

import enUS from './en-US.json'
import zhCN from './zh-CN.json'

export const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zhCN, 'en-US': enUS } })
