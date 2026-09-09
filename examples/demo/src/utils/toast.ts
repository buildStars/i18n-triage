import { showToast } from 'vant'

/** 项目自封装的提示：通过 i18n-triage.config.mjs 的 uiApis 配成 A */
export function myToast(message: string): void {
  showToast({ message, duration: 1500 })
}

myToast('操作成功')
