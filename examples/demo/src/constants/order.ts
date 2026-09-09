// 订单相关字典：constants/ 目录 + 同一对象 ≥3 个中文 value → C

export const STATUS_OPTIONS = [
  { label: '待支付', value: 0 },
  { label: '已支付', value: 1 },
  { label: '已发货', value: 2 },
  { label: '已完成', value: 3 },
  { label: '已取消', value: 4 },
]

export const STATUS_TEXT: Record<number, string> = {
  0: '待支付',
  1: '已支付',
  2: '已发货',
  3: '已完成',
  4: '已取消',
}

/** key 是中文：D 内部键，不是字典 value */
export const STATUS_CODE = { 待支付: 0, 已支付: 1, 已发货: 2 }

/** 只有一个中文 value，达不到阈值：兜底 A（待确认） */
export const DEFAULT_REMARK = { text: '无备注' }
