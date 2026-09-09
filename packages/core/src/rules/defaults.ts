/**
 * 规则层的默认白名单与阈值。规则函数里不要硬编码这些值，全部从这里取；
 * CLI 配置文件可以整体覆盖任一列表。
 *
 * 被调用者模式语法（见 callee-match.ts）：
 * - `showToast`     精确匹配整个点号全名
 * - `console.*`     某个非末尾段等于 console（`console.log`、`window.console.error`、`console[]`）
 * - `*.t`           末尾段等于 t 且前面有接收者（`i18n.t`、`this.$i18n.t`）
 *
 * 属性名模式语法：
 * - `placeholder`   精确（kebab-case 归一化后比较）
 * - `*-text`        以 -text 结尾
 * - `data-*`        以 data- 开头
 */

/** A：展示类属性（模板属性名，或对象字面量里的属性名） */
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
  // vant / element-plus / antd 等常见展示 prop
  'text',
  'tip',
  'tips',
  'message',
  'content',
  'subtitle',
  'sub-title',
  'header',
  'desc',
  'hint',
  'help',
  'unit',
  'tooltip',
  'aria-label',
  'range-separator',
  'empty-description',
  'no-data-text',
  // antd：输入框前后缀文字、Switch 开关文字
  'addon-after',
  'addon-before',
  'checked-children',
  'un-checked-children',
  // Day 7 真实项目验证：component 库的展示 prop 命名高度规律，用后缀覆盖
  // （active-text / inactive-text / element-loading-text / table-title / start-placeholder / title-tooltip / table-title-help …）
  '*-text',
  '*-title',
  '*-placeholder',
  '*-tooltip',
  '*-label',
  '*-description',
  '*-message',
  '*-tip',
  '*-tips',
  '*-help',
  '*-hint',
  '*-content',
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
  // ant-design-vue / naive-ui / TDesign（Day 7：vben、yudao 里实际出现）
  'notification',
  'notification.*',
  'Modal',
  'Modal.*',
  'modal.*',
  'dialog.*',
  'MessagePlugin.*',
  'DialogPlugin.*',
  'NotifyPlugin.*',
  // Vue 2 实例方法 / RuoYi 的 proxy.$modal：this.$message('x') / proxy.$modal.msgSuccess('x')
  '*.$message',
  '*.$toast',
  '*.$notify',
  '*.$alert',
  '*.$confirm',
  '*.$prompt',
  '*.$dialog',
  '*.$modal',
  '$toast.*',
  '$notify.*',
  '$dialog.*',
  '$modal.*',
  // 渲染函数：h('span', '文案')
  'h',
  // zod 校验消息：z.string().min(1, '请输入用户名')
  'z.*',
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

/** C：字典目录名（任意层级），或同名文件（constants.ts / consts.ts） */
export const DEFAULT_DICT_DIRS: readonly string[] = [
  'constants',
  'constant',
  'consts',
  'const',
  'enum',
  'enums',
  'dict',
  'dicts',
  'dictionary',
  'dictionaries',
]

/** C：同一对象（或 options 数组）里含中文 value 的最低个数 */
export const DEFAULT_DICT_SIBLING_THRESHOLD = 3

/**
 * D：值永远不是展示文案的模板属性——DOM / SVG 的标识与几何属性、埋点属性。
 * Day 7 真实项目验证：设计工具导出的 SVG 组件会把图层名写进 id / fill / stroke（`id="矩形"`）。
 */
export const DEFAULT_INTERNAL_ATTRS: readonly string[] = [
  'id',
  'class',
  'key',
  'ref',
  'name',
  'for',
  'slot',
  'is',
  'href',
  'xlink:href',
  'src',
  'style',
  'fill',
  'stroke',
  'd',
  'points',
  'filter',
  'mask',
  'clip-path',
  'view-box',
  'transform',
  'data-*',
]

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
