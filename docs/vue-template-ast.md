# `@vue/compiler-dom` template AST 对照表

> 依据：`packages/core/scripts/dump-vue-ast.mjs` 对一个真实 `.vue` 的三种 dump 结果（Vue 3.5.42）。
> 重跑：`node packages/core/scripts/dump-vue-ast.mjs`

## 结论：用 `descriptor.template.ast`，不再二次 `compile()`

`@vue/compiler-sfc` 的 `parse()` 在 3.4+ 内部就是用 `@vue/compiler-dom` 的 parser 以 `parseMode: 'sfc'`
解析**整个文件**，并把 `<template>` 的子节点包成一个 `RootNode` 挂在 `descriptor.template.ast` 上。
三种拿 AST 的方式对比：

| 方式                                                          | 节点形状                                                                                                                                                                                        | 位置基准               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `parseSfc(src).descriptor.template.ast`                       | **原始 parse AST**（ELEMENT / TEXT / COMMENT / INTERPOLATION / ATTRIBUTE / DIRECTIVE）                                                                                                          | **相对整个 .vue 文件** |
| `parseDom(template.content)`                                  | 同上                                                                                                                                                                                            | 相对 template 内容     |
| `compile(template.content, { prefixIdentifiers: false }).ast` | **transform 后**：TEXT 被包成 `TEXT_CALL`；`v-if` 变 `IF`/`IF_BRANCH`；`v-for` 变 `FOR`（并从 props 里移除）；相邻 插值+文本 合并成 `COMPOUND_EXPRESSION`，children 里夹着 `" + "` 这类裸字符串 | 相对 template 内容     |

选第一种的理由：

1. 位置天然是整文件的（实测：`<!-- 顶部注释 -->` 在 template 内偏移 3、template 块起点 62，`descriptor.template.ast` 直接给 65 / 第 6 行），不用手工加 `template.loc.start.offset`，也不会算错。
2. 原始 AST 节点类型只有 6 种，遍历简单；transform 后的 AST 多了 IF / FOR / TEXT_CALL / COMPOUND_EXPRESSION 等包装层，而这些对「找字符串」毫无帮助。
3. 只解析一次。`compile()` 会再 parse 一遍并跑完整 transform + codegen，白费。

「用 `@vue/compiler-dom` 拿 AST、不要 codegen」这条技术选型没变——`descriptor.template.ast` 就是 compiler-dom 的 AST，只是入口换成了 compiler-sfc 已经帮我们调过的那一次。

注意：`<template lang="pug">` 或 `<template src="...">` 时 `ast` 为 `undefined`，解析器直接返回空数组。

## NodeTypes 枚举（运行时值）

```
0=ROOT 1=ELEMENT 2=TEXT 3=COMMENT 4=SIMPLE_EXPRESSION 5=INTERPOLATION 6=ATTRIBUTE 7=DIRECTIVE
8=COMPOUND_EXPRESSION 9=IF 10=IF_BRANCH 11=FOR 12=TEXT_CALL 13=VNODE_CALL 14~ JS_* / JS_BLOCK_* (codegen 用)
```

原始 parse AST 里只会出现 **0–7**。8 以后都是 transform / codegen 阶段产物。

## 原始 parse AST：NodeTypes → 节点结构 → 我们怎么用

| NodeTypes               | 关键字段                                                                                                                                                                                                                              | 实测样例                                                                                                                                        | 处理                                                                                                                                                                                                                                                       |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ROOT` (0)              | `children: TemplateChildNode[]`；`loc` 为 `1:1@0-0`（无意义），`source` 是整个文件                                                                                                                                                    | —                                                                                                                                               | 遍历 `children`                                                                                                                                                                                                                                            |
| `ELEMENT` (1)           | `tag`、`tagType`（0 元素 / 1 组件 / 2 slot / 3 template）、`props: (AttributeNode \| DirectiveNode)[]`、`children`                                                                                                                    | `<div class="wrap" title="标题">` → loc `7:3@81`                                                                                                | 遍历 `props` 与 `children`                                                                                                                                                                                                                                 |
| `TEXT` (2)              | `content`（**已按 `condense` 压缩空白**）、`loc.source`（**原始文本，含前后换行缩进**）                                                                                                                                               | content `" 暂无数据 "`，loc.source `"\n    暂无数据\n    "`，loc `7:32@110`                                                                     | `kind: 'template-text'`，`value = content.trim()`；位置取 `loc.source` 里**第一个非空白字符**（上例 → 第 8 行第 5 列，offset 115），不是节点起点的换行符                                                                                                   |
| `COMMENT` (3)           | `content`、`loc`                                                                                                                                                                                                                      | `<!-- 顶部注释 -->` → content `" 顶部注释 "`                                                                                                    | **整棵跳过**。这是核心卖点之一，必须有独立测试                                                                                                                                                                                                             |
| `SIMPLE_EXPRESSION` (4) | `content: string`、`isStatic`、`loc`（只覆盖表达式本身，不含引号/花括号）                                                                                                                                                             | `ok ? '成功' : '失败'` → loc `10:14@184`                                                                                                        | 不单独出现，只作为 INTERPOLATION 的 `content`、DIRECTIVE 的 `arg` / `exp`                                                                                                                                                                                  |
| `INTERPOLATION` (5)     | `content: SimpleExpressionNode`；自身 `loc` 含 `{{ }}`                                                                                                                                                                                | `{{ ok ? '成功' : '失败' }}` → 自身 `10:11@181`，content `10:14@184`                                                                            | 用 TypeScript parser 解析 `content.content`，取其中的字符串字面量（含模板字符串静态段）→ `kind: 'literal'`；位置 = `content.loc.start.offset + 字面量在表达式内的偏移`                                                                                     |
| `ATTRIBUTE` (6)         | `name`、`value?: TextNode`；`value.loc` **含引号**（`"标题"` → `7:27@105-109`），`value.content` 不含引号；无值属性 `value` 为 `undefined`                                                                                            | `placeholder="请输入订单号"` → name `placeholder`，value.content `请输入订单号`，value.loc `9:24@143`                                           | `kind: 'template-attr'`，`attrName = name`，`value = value.content`，位置 = `value.loc.start`（指向引号，便于后续 `--fix` 整体替换）                                                                                                                       |
| `DIRECTIVE` (7)         | `name`（`bind` / `on` / `if` / `else` / `for` / `slot` / `model`…，**不含 `v-` 前缀**）、`rawName`（`:title` / `@click`）、`arg?: SimpleExpressionNode`（`isStatic: true` 时是静态属性名）、`exp?: SimpleExpressionNode`、`modifiers` | `:title="'绑定标题'"` → name `bind`，arg.content `title`，exp.content `'绑定标题'`；`@click="go('去哪')"` → name `on`，exp.content `go('去哪')` | 解析 `exp.content` 里的字符串字面量。若 `name === 'bind'` 且 `arg.isStatic` 且**整个表达式就是一个字符串字面量** → `kind: 'template-attr'`，`attrName = arg.content`（`:placeholder="'请输入'"` 和静态写法等价）；否则 → `kind: 'literal'`。`arg` 本身不扫 |

## 位置约定（`StringNode.loc`）

- `offset` 0-based，`line` / `column` 1-based，全部**相对整个 .vue 文件**。
- `column` 按 UTF-16 code unit 计数（与 Vue 一致；实测 `{{ item.name }} 件` 里的 ` 件` 在 `13:60@317`，317 − 行首 258 = 59 → 第 60 列）。
- 统一指向**AST 节点起点**：属性值 → 开头引号；JS 字符串字面量 → 开头引号/反引号；文本节点 → 第一个非空白字符（节点起点常是换行符，没意义）。
- 行列不信任 Vue 给的 `line` / `column` 再做加减，而是用 `utils/line-index.ts` 从整文件 `offset` 反查，避免多段偏移叠加出错；测试里再和 Vue 自带的行列交叉核对。

## `descriptor` 其他块（供 Day 3 参考）

| 块                                             | `loc.start.offset` 含义                                                       | 用途                                                                |
| ---------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `descriptor.script` / `descriptor.scriptSetup` | `content` 在整文件中的起点（实测 `<script setup lang="ts">` 后紧跟的位置 24） | Day 3 把 `content` 交给 `parseScript`，再把结果 offset 加上这个起点 |
| `descriptor.template`                          | template 内容起点（实测 62）                                                  | 已由 `template.ast` 处理，无需再用                                  |
| `descriptor.styles[]`                          | —                                                                             | **不扫**                                                            |
| `descriptor.customBlocks[]`（如 `<i18n>`）     | —                                                                             | 不扫                                                                |
