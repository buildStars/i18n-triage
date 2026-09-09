# ts-morph 节点类型 → `StringKind` 判定表

> 依据：`packages/core/scripts/dump-ts-ast.mjs` 在 ts-morph 28（内置 TypeScript 6.0.2）上的实测父链。
> 重跑：`node packages/core/scripts/dump-ts-ast.mjs`

## 要访问的「字符串类」节点

| SyntaxKind                                         | 说明                                                                      | 取值                                                        |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `StringLiteral`                                    | `'x'` / `"x"`                                                             | `getLiteralText()`（已解转义）                              |
| `NoSubstitutionTemplateLiteral`                    | `` `x` ``                                                                 | `getLiteralText()`                                          |
| `TemplateHead` / `TemplateMiddle` / `TemplateTail` | `` `a${n}b${m}c` `` 的三个静态段；空段（如 `` `警告${x}` `` 的 tail）跳过 | `getLiteralText()`；位置：head 是反引号，middle/tail 是 `}` |
| `JsxText`                                          | `<div>文本</div>` 里的文本                                                | `getText()` 压缩空白后 trim；位置取第一个非空白字符         |

正则 `RegularExpressionLiteral` 是另一种 kind，天然不在此列。注释是 trivia，不是节点；JSDoc 节点 **不会** 被 `forEachDescendant` 访问（实测 0 个）。

## 先看「包裹层」再看父节点

判定 kind 时，先从字面量向上跳过**不改变语义的包裹层**，得到 `expr`，再看 `expr.getParent()`：

| 透明包裹层（跳过）                                                                                         | 说明                                              |
| ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| `ParenthesizedExpression` / `AsExpression` / `SatisfiesExpression` / `NonNullExpression` / `TypeAssertion` | `('x')`、`'x' as const`、`'x'!`                   |
| `TemplateSpan` → `TemplateExpression`                                                                      | 模板静态段的归属看整个模板字符串所在位置          |
| `ConditionalExpression`                                                                                    | `ok ? '成功' : '失败'` 两个分支都属于三元所在位置 |
| `BinaryExpression`，且运算符是 `+` / `??` / `\|\|`                                                         | 字符串拼接 / 兜底：`'共' + n + '条'`              |

`BinaryExpression` 的**比较运算符**（`===` / `==` / `!==` / `!=` / `<` …）**不透明**：`status === '已封盘'` 直接判 `literal`。

## 父节点 → kind

| `expr.getParent()`                                                                                                                                                                    | 条件                                               | kind            | 附加字段                                                           | 实测样例                                           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | --------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| `CallExpression` / `NewExpression`                                                                                                                                                    | `expr` 在 `getArguments()` 里（不是被调用者本身）  | `call-arg`      | `calleeName` = 被调用者点号全名（见下）                            | `showToast('已封盘')`、`new Error('x')`            |
| `TaggedTemplateExpression`                                                                                                                                                            | `expr` 是模板部分                                  | `call-arg`      | `calleeName` = 标签名                                              | `` css`…` ``、`` i18n`中文` ``                     |
| `PropertyAssignment`                                                                                                                                                                  | `expr === getInitializer()`                        | `object-value`  | `siblingChineseCount`（见下）；若对象在调用实参里再带 `calleeName` | `{ label: '联盟' }`、`showToast({ message: 'x' })` |
| `PropertyAssignment`                                                                                                                                                                  | `expr === getNameNode()`                           | `object-key`    |                                                                    | `{ '联盟': 1 }`                                    |
| `ComputedPropertyName`                                                                                                                                                                | —                                                  | `object-key`    |                                                                    | `{ ['计算键']: 2 }`                                |
| `ArrayLiteralExpression`                                                                                                                                                              | 数组本身是某个 `PropertyAssignment` 的 initializer | `object-value`  | 每个中文元素计入 `siblingChineseCount`                             | `{ tags: ['标签一', '标签二'] }`                   |
| `ArrayLiteralExpression`                                                                                                                                                              | 其他                                               | `literal`       |                                                                    | `const arr = ['甲', '乙']`                         |
| `EnumMember`                                                                                                                                                                          | 作为 initializer 或 name                           | `enum-member`   |                                                                    | `enum C { Red = '红波', '中文成员' = 3 }`          |
| `ElementAccessExpression`                                                                                                                                                             | `expr === getArgumentExpression()`                 | `object-key`    | 这就是规则表 D ③「被用作 map 索引」                                | `dict['联盟']`、`dict?.['键']`                     |
| `JsxAttribute`；或 `JsxExpression` 且其父是 `JsxAttribute`                                                                                                                            | —                                                  | `template-attr` | `attrName` = 属性名                                                | `<div title="属性" data-x={'表达式属性'}>`         |
| `JsxText`（节点自身）                                                                                                                                                                 | 含中文                                             | `template-text` |                                                                    | `<div>文本节点</div>`                              |
| `JsxExpression`（在子节点位置）                                                                                                                                                       | —                                                  | `literal`       |                                                                    | `<div>{'花括号文本'}</div>`                        |
| 其他（`VariableDeclaration` / `ReturnStatement` / `Parameter` / `PropertyDeclaration` / `CaseClause` / `ExpressionStatement` / `ArrowFunction` 表达式体 / 比较 `BinaryExpression` …） | —                                                  | `literal`       |                                                                    | `const v = '裸'`、`return '值'`、`case '分支':`    |

## 完全跳过（不产生节点）

| 场景                       | 判定                                                                                                         |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| import / export 路径       | 父是 `ImportDeclaration` / `ExportDeclaration`（`moduleSpecifier`）、`ImportType`、`ExternalModuleReference` |
| 动态 import / require      | 父是 `CallExpression` 且被调用者是 `ImportKeyword` 或标识符 `require`                                        |
| 字符串字面量**类型**       | 父是 `LiteralType`（`type S = '已封盘' \| '未封盘'`、`Record<'键', X>`）——类型层，运行时不渲染               |
| 接口 / 类型成员名          | 父是 `PropertySignature` / `MethodSignature` 且 `expr` 是其 name                                             |
| 模块声明名                 | 父是 `ModuleDeclaration`（`declare module '中文模块'`）                                                      |
| 注释（`//` `/* */` JSDoc） | 不是节点，遍历不到                                                                                           |
| 正则字面量                 | 另一种 SyntaxKind                                                                                            |
| 不含中文的任何字符串       | `containsChinese()` 过滤                                                                                     |

## `calleeName`：被调用者点号全名

`getCalleeName(call.getExpression())`：

| 被调用者形态                     | 输出                                                                       |
| -------------------------------- | -------------------------------------------------------------------------- |
| `Identifier`                     | `showToast`                                                                |
| `PropertyAccessExpression`       | 递归拼接：`console.error`、`this.$message.success`、`ElMessageBox.confirm` |
| `ElementAccessExpression`        | 参数是字符串 → `api.fetch`；否则 `api[]`                                   |
| `CallExpression`（`foo()('x')`） | `foo()`                                                                    |
| 包裹层（括号 / `as` / `!`）      | 去壳后递归                                                                 |
| `ThisKeyword` / `SuperKeyword`   | `this` / `super`                                                           |
| 其他（如 `(cond ? a : b)('x')`） | `undefined`                                                                |

**嵌套调用取最近的**：`showToast(t('已封盘'))` 里 `'已封盘'` 的 `calleeName` 是 `t`，不是 `showToast`。

**非 call-arg 也带 `calleeName`**（扩展）：`showToast({ message: '对象参数' })`、`ElMessageBox.confirm({ title: '标题', buttons: { ok: '确定' } })`
里的 object-value，沿透明层 + `PropertyAssignment` / `ObjectLiteralExpression` / `ArrayLiteralExpression` / `SpreadElement` 向上，
碰到第一个把它当**实参**的调用即记为 `calleeName`。遇到函数边界（箭头函数 / 函数表达式）、语句、声明就停——
`list.map((x) => x.label + '元')` 里的 `'元'` 不属于 `map`。这样 A / B 规则可以对 vant / element-plus 的对象式调用
（`showToast({ message })`、`ElMessage({ message, type })`）一样生效。

## `siblingChineseCount`：同一层对象里含中文的 value 数

- 只统计**直接** `PropertyAssignment` 的 initializer（字符串 / 模板字符串任一静态段含中文），以及 initializer 是数组时数组里的直接字符串元素；**不递归进嵌套对象**（嵌套对象自己算自己的）。
- **对象是数组元素时，按整个数组统计**：`[{ label: '待支付', value: 0 }, { label: '已支付', value: 1 }, { label: '已取消', value: 2 }]`
  每个 `label` 的 `siblingChineseCount` 都是 3。这是 Vue 项目里最常见的字典形态（options 列表），若按单个对象算永远是 1，C 规则会失效。
- 只对 `object-value` 填写；其他 kind 不填。

## 位置

- `offset = node.getStart()`（跳过前导 trivia；字符串指向引号 / 反引号，模板 middle/tail 指向 `}`），`JsxText` 取第一个非空白字符。
- 行列用 `utils/line-index.ts` 从**传入的源码字符串**反查。
- `.vue` 的 `<script>` 块：把整文件里 script 块**以外**的字符全部替换成空格（保留 `\n` / `\r`），再整段交给 `parseScript`，
  得到的 offset / 行列天然就是整文件坐标，不需要任何偏移加减。两个 script 块（`<script>` + `<script setup>`）各遮罩一次、分别解析。
- 方言：`.ts` → TS，`.tsx` → TSX，`.js` → JS（TypeScript 的 JS 模式本身允许 JSX），`.jsx` → JSX；`.vue` 按 `<script lang>`（无 → JS）。

## 对外 API

```ts
parseScript(source, ctx, options?: { dialect?: 'ts' | 'tsx' | 'js' | 'jsx' }): StringNode[]
parseVueSfc(source, ctx): StringNode[]   // template + 所有 script 块，按 offset 排序
parseSource(source, ctx): StringNode[]   // 按 ctx.relativePath 后缀分派：.vue → parseVueSfc，其余 → parseScript
```
