/**
 * 规则层的默认白名单与阈值。规则函数里不要硬编码这些值，全部从这里取；
 * CLI 配置文件可以整体覆盖任一列表。
 *
 * 被调用者模式语法（见 callee-match.ts）：
 * - `showToast`     精确匹配整个点号全名
 * - `console.*`     某个非末尾段等于 console（`console.log`、`window.console.error`）
 * - `*.t`           末尾段等于 t 且前面有接收者（`i18n.t`、`this.$i18n.t`）
 */

/** A：展示类属性（kebab-case；camelCase 写法在匹配前会被归一化） */
export const DEFAULT_DISPLAY_ATTRS: readonly string[] = [
  // 规则表明确列出的
  'placeholder',
  'title',
  'label',
  'alt',
  'confirm-button-text',
  'cancel-button-text',
  'description',
  'empty-text',
  // vant / element-plus 等常见展示 prop
  'text',
  'tip',
  'message',
  'content',
  'subtitle',
  'sub-title',
  'button-text',
  'confirm-text',
  'cancel-text',
  'ok-text',
  'loading-text',
  'finished-text',
  'error-text',
  'empty-description',
  'no-data-text',
  'aria-label',
  'tooltip',
]

/** A：UI 提示 API（实参是展示给用户的文案） */
export const DEFAULT_UI_APIS: readonly string[] = [
  // 规则表明确列出的
  'showToast',
  'showDialog',
  'showConfirmDialog',
  'Notify',
  'ElMessage',
  'ElMessageBox',
  'message.*',
  '$message.*',
  // vant 4
  'showNotify',
  'showLoadingToast',
  'showSuccessToast',
  'showFailToast',
  'Toast',
  'Toast.*',
  'Dialog',
  'Dialog.*',
  'Notify.*',
  // element-plus / element-ui
  'ElMessage.*',
  'ElMessageBox.*',
  'ElNotification',
  'ElNotification.*',
  'ElLoading.*',
  'Message',
  'Message.*',
  'MessageBox',
  'MessageBox.*',
  'Notification',
  'Notification.*',
  // Vue 2 实例方法：this.$message('x') / this.$toast.fail('x')
  '*.$message',
  '*.$toast',
  '*.$notify',
  '*.$alert',
  '*.$confirm',
  '*.$prompt',
  '*.$dialog',
  '$toast.*',
  '$notify.*',
  '$dialog.*',
  // 浏览器 / 小程序
  'alert',
  'confirm',
  'prompt',
  'uni.showToast',
  'uni.showModal',
  'uni.showLoading',
  'wx.showToast',
  'wx.showModal',
  'wx.showLoading',
]

/** B：调试 / 日志 API */
export const DEFAULT_DEBUG_APIS: readonly string[] = [
  'console.*',
  'logger.*',
  'devLogger.*',
  'debug.*',
  'log',
  'log.*',
]

/** C：字典目录名（任意层级），或同名文件（constants.ts） */
export const DEFAULT_DICT_DIRS: readonly string[] = [
  'constants',
  'constant',
  'enum',
  'enums',
  'dict',
  'dicts',
  'dictionary',
  'dictionaries',
]

/** C：同一对象（或 options 数组）里含中文 value 的最低个数 */
export const DEFAULT_DICT_SIBLING_THRESHOLD = 3

/** 已接入 i18n 的调用：实参是 key 或插值参数，不是待翻译文案，在进规则前整体剔除 */
export const DEFAULT_I18N_CALLEES: readonly string[] = [
  't',
  '$t',
  'tc',
  '$tc',
  'te',
  '$te',
  'tm',
  '$tm',
  'rt',
  '$rt',
  '*.t',
  '*.$t',
  '*.tc',
  '*.$tc',
  '*.te',
  '*.$te',
  '*.tm',
  '*.$tm',
  '*.rt',
  '*.$rt',
]
