/** 字符串在源码中的位置类型 */
export type StringKind =
  | 'template-text' // template 中的文本节点
  | 'template-attr' // template 中的属性值
  | 'call-arg' // 函数调用实参
  | 'object-value' // 对象字面量的 value
  | 'object-key' // 对象字面量的 key
  | 'enum-member' // enum 成员值
  | 'literal' // 其他裸字符串字面量

export type Category = 'A_UI_TEXT' | 'B_DEBUG_LOG' | 'C_DICT' | 'D_INTERNAL_KEY'

export interface SourceLocation {
  file: string
  line: number // 1-based
  column: number // 1-based
  offset: number // 0-based，相对整个文件
}

export interface StringNode {
  value: string
  loc: SourceLocation
  kind: StringKind
  /** kind === 'template-attr' 时的属性名；kind === 'object-value' 时为所属属性名（`{ label: 'x' }` → 'label'） */
  attrName?: string
  /** kind === 'call-arg' 时的被调用者全名，如 'showToast' / 'console.error' / 'logger.warn' */
  calleeName?: string
  /** kind === 'object-value' 时，同一对象字面量内含中文的 value 总数 */
  siblingChineseCount?: number
}

export interface FileContext {
  /** 相对项目根的路径，用于目录级判定（如是否在 constants/ 下） */
  relativePath: string
}

/** 分类规则：命中返回分类，不命中返回 null。按优先级串行，第一个命中者胜出 */
export type Rule = (node: StringNode, ctx: FileContext) => Category | null

export interface TriageResult {
  node: StringNode
  category: Category
  /** 命中的规则名，用于调试和报告 */
  matchedBy: string
}
