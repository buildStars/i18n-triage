/** enum 成员：D 内部键 */
export enum PayChannel {
  Alipay = '支付宝',
  Wechat = '微信支付',
  Bank = '银行卡',
}

/** enums/ 目录下的映射表：C 数据字典 */
export const PAY_CHANNEL_TEXT = {
  [PayChannel.Alipay]: '支付宝支付',
  [PayChannel.Wechat]: '微信支付',
  [PayChannel.Bank]: '银行卡支付',
}
