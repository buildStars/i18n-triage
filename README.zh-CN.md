# i18n-triage

**只把真正需要翻译的硬编码中文推到你面前。**

现有的 i18n 扫描器用正则找中文字符然后全部报出来。i18n-triage 走真正的 AST（`@vue/compiler-sfc` + `ts-morph`），按字符串**所在的位置**和**被谁消费**分成四类，只有 A 类——用户会看到的文案——需要你处理。

[![CI](https://github.com/buildStars/i18n-triage/actions/workflows/ci.yml/badge.svg)](https://github.com/buildStars/i18n-triage/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

[English README](./README.md) · [真实项目验证报告](./docs/validation.md)

```
$ i18n-triage ./vue-vben-admin

i18n-triage  扫描 1,337 个文件

━━ 摘要 ━━
  扫到含中文片段            9,899 处  （正则口径）
  ├─ A 必翻译 UI 文案       2,514 处  ← 需处理（其中 336 处待确认）
  ├─ B 调试日志                 8 处  （已归档）
  ├─ C 数据字典                 0 处  ← 需独立方案
  └─ D 内部键                  86 处  （已归档）
  已接入 i18n 的调用            0 处  （t / $t，已排除）
  注释等已忽略              7,291 处
  跳过疑似压缩 / 生成文件       1 个  （见文末）

  降噪比    9,899 → 2,514  （74.6% 为噪音）
```

四个真实项目实测（明细、抽样与误判清单见 [docs/validation.md](./docs/validation.md)）：

| 项目                                                                                 | 文件数 | 正则口径 |               A 必翻译 | B 日志 | C 字典 | D 内部键 | 噪音占比 |
| ------------------------------------------------------------------------------------ | -----: | -------: | ---------------------: | -----: | -----: | -------: | -------: |
| [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)                           |  1,337 |    9,899 |    2,514（336 待确认） |      8 |      0 |       86 |    74.6% |
| [vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin) |     77 |       28 |                      4 |      3 |      0 |        0 |    85.7% |
| [yudao-ui-admin-vue3](https://github.com/yudaocode/yudao-ui-admin-vue3)              |  2,602 |   97,118 | 29,235（3,122 待确认） |    233 |    319 |       16 |    69.9% |
| [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3)                            |    166 |    4,739 |    2,691（167 待确认） |      2 |      6 |        1 |    43.2% |

对 A 类等距抽样 64 条人工复核：**60 条明确是 UI 文案，4 条存疑，0 条错误**（精确率 93.8%～100%）；B / C / D 抽样在修复后全部正确。RuoYi 完全没有接 i18n，43% 的噪音是合理下限——它剩下的中文几乎都真的要翻。

## 问题

在一个成熟的中文后台项目上跑任何正则式扫描器，你会得到五位数的结果。yudao-ui-admin-vue3 用 `/[一-鿿]+/` 能匹配 **97,118** 处，其中 **67,313 处（69%）是注释、import 路径、正则这些永远到不了屏幕的东西**，233 处是 `console.*`，319 处是应该整表翻译的字典，16 处是对象 key。没人会手工过 9 万多行的清单，于是清单被忽略，硬编码留在那里。

## 四类

| 类                   | 判定依据                                                                                                                                                                                                                                                         | 处置                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **A 必翻译 UI 文案** | ① template 文本节点 ② 展示属性 / prop（`placeholder` `title` `label` `alt` `confirm-button-text` `*-text` `*-placeholder` `{ message }` `{ label }` …）③ UI 提示 API 实参（`showToast` `ElMessage` `message.*` `$modal.*` `h` `notification[type]` zod `z.*` …） | 报出来，按文件分组                                 |
| **B 调试日志**       | `console.*` `logger.*` `devLogger.*` `debug.*` `log` 的实参                                                                                                                                                                                                      | 归档，默认不显示                                   |
| **C 数据字典**       | 位于 `constants/` `consts/` `enum(s)/` `dict/`（或同名文件），对象字面量的 value，同一对象 / options 数组里 ≥ 3 个中文 value                                                                                                                                     | 按文件汇总，提示「走配置化翻译表，不要逐句抽 key」 |
| **D 内部键**         | 对象 key、enum 成员、map 索引，以及标识类属性的值（`id` `class` `key` `ref` `name` `fill` `stroke` `data-*` …）                                                                                                                                                  | 归档，默认不显示                                   |
| _忽略_               | 注释（`//` `/* */` `<!-- -->`）、`<style>`、import/export 路径、正则、字符串字面量类型、JSDoc                                                                                                                                                                    | 不进入分类                                         |

规则按 **B → D → C → A** 串行，第一个命中者胜出；谁都不认领的字符串兜底进 A 并标 `待确认`，保证用户可见的文案不会被静默丢掉。`t()` / `$t()` / `*.t` 的实参在分类前整体剔除——它们已经翻译过了。

## 为什么必须用 AST 而不是正则

正则看到的是同样四个字，AST 看到的是四件不同的事：

| 代码                                                              | 正则看到      | i18n-triage 看到                           |
| ----------------------------------------------------------------- | ------------- | ------------------------------------------ |
| `{ '联盟': 1 }` vs `{ label: '联盟' }`                            | `'联盟'` ×2   | **D** 对象 key vs **A** 展示 prop 的 value |
| `t('已封盘')` vs `showToast('已封盘')`                            | `'已封盘'` ×2 | 已接入（剔除）vs **A** UI API 实参         |
| `// 已封盘` vs `"已封盘"`                                         | `已封盘` ×2   | 什么都没有 vs 一个字符串节点               |
| 同一份 options 列表在 `constants/lottery.ts` vs `views/Order.vue` | 一模一样      | **C** 字典 vs **A** UI 文案                |

模板表达式一视同仁：`{{ t('已封盘') }}` 是 `t` 的 `call-arg`、被剔除；`@click="showToast('已封盘')"` 是 `showToast` 的 `call-arg`、判 A——表达式会连同被遮罩成空格的整个 `.vue` 文件交给 TypeScript parser，所以 kind、被调用者名字、整文件位置都是精确的。

## 安装与使用

尚未发布到 npm。克隆后（从源码构建需要 Node 22.18+，因为 tsdown 的要求；发布出去的 CLI 本身在 Node 20.19+ 上可运行）：

```bash
pnpm install
pnpm triage path/to/your/project              # 文本报告，默认显示 A + C
pnpm triage path/to/your/project --only all   # 四类全部显示
pnpm triage path/to/your/project --format json --out report.json
```

或者构建独立可执行文件：

```bash
pnpm --filter @i18n-triage/cli build
node packages/cli/dist/bin.js path/to/your/project
```

参数：

```
i18n-triage [...paths]

  --format <text|json|sarif>   默认 text；sarif 可直接上传 GitHub Code Scanning
  --only <letters>       如 A,C（默认）或 all
  --config <path>        默认在 cwd、然后在被扫描目录里找 i18n-triage.config.{ts,mts,js,mjs,cjs,json}
  --out <path>           把报告写到文件
  --no-color
```

有文件解析失败时退出码 1（报告末尾会列出），致命错误 2。

### 配置

```ts
// i18n-triage.config.ts
import { defineConfig } from '@i18n-triage/cli'

export default defineConfig({
  // 各列表默认追加到内置白名单之后；extendDefaults: false 则整体替换
  uiApis: ['myToast', 'tipText', '$tab.*'], // 项目自封装的提示函数
  displayAttrs: ['tip-text'], // 额外的展示属性 / prop
  debugApis: ['Sentry.*'],
  dictDirs: ['dictionaries'],
  dictSiblingThreshold: 3,
  internalAttrs: ['track-*'], // 值永远不是文案的属性
  i18nCallees: ['translate'], // 额外的已接入 i18n 的调用
  ignore: ['**/legacy/**'], // 在 node_modules / dist / locales / mock / 测试 / *.min.js … 之上追加
  maxFileSize: 300_000, // 超过即视为生成物跳过
  only: 'A,C',
  format: 'text',
})
```

模式语法：`showToast` 精确 · `console.*` 任一非末尾段 · `*.t` 末尾段 · `*-text` 属性后缀 · `data-*` 属性前缀。

### GitHub Action

仓库根目录的 `action.yml` 是一个 composite action：用 `--format sarif` 跑 CLI，再把结果上传到 GitHub Code Scanning，于是每条硬编码文案都会变成 PR 里的行内注释。

```yaml
# .github/workflows/i18n.yml
on: [pull_request]
permissions:
  contents: read
  security-events: write
jobs:
  i18n-triage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: buildStars/i18n-triage@v0.1.0
        with:
          paths: src
          only: A,C
```

输入：`paths`、`only`、`config`、`output`、`upload`、`category`、`version`（`@i18n-triage/cli` 的 npm 版本）、`fail-on-parse-error`。输出：`sarif-file`、`ui-text-count`。

## 架构

```
                 ┌──────────────────────── @i18n-triage/core（纯函数，零 IO）───────────────────────┐
   源码字符串 ──►│ parsers/                    rules/                                              │
                 │  vue-sfc  ──┐                excludeI18nCalls ─► triage([B, D, C, A]，兜底 A)   │─► TriageResult[]
                 │  script   ──┼─► StringNode[] ─┘                                                  │
                 │  expression─┘   (kind · calleeName · attrName · siblingChineseCount · loc)       │
                 └───────────────────────────────────────────────────────────────────────────────────┘
                          ▲                                                              │
   @i18n-triage/cli       │ readFile                                                     ▼
   discover（glob）───────┘                                    @i18n-triage/reporters: buildScanReport → text | json
```

- **`core` 不碰文件系统**：解析器吃源码字符串，规则吃 `StringNode`。ESLint 规则 `noNodeIo` 保证 `packages/core` 里任何对 `fs` / `path` / `process` 的引用都过不了 lint。
- **规则就是带名字的普通函数** `(node, ctx) => Category | null`。可以换顺序、加自己的规则，或者用 `createDefaultRules(config)` 改默认白名单。
- **`.vue` 只解析一次**：template 位置直接来自 `descriptor.template.ast`（整文件坐标），`<script>` 块和模板表达式把其余部分遮罩成空格后交给 `ts-morph`，全程没有偏移量加减。
- **`reporters`** 只做 `TriageResult[] → 文本 / JSON`；**`cli`** 拥有全部 IO。

设计文档：[docs/vue-template-ast.md](./docs/vue-template-ast.md)、[docs/ts-morph-kinds.md](./docs/ts-morph-kinds.md)。

## 已知局限

- 之后被渲染成标题的对象 key（`{ '置顶': [], '今天': [] }`）按定义是 D——如果你的项目有这种写法，把 D 过一遍。
- `new Error('…')` 的消息、导出文件名（`download.excel(data, '报表.xls')`）、`{ name: '…' }` 留在 A 的待确认档：是否给用户看取决于项目。
- 项目自封装的提示函数（`tipText()`、`requiredRule()`）工具不猜——加到 `uiApis` 即可。

## Roadmap

- `--fix`：把 A 类抽成语言包并替换为 `t('key')`
- 语言包完整度校验、死 key 检测
- SARIF 输出接 GitHub Code Scanning（PR 行内注释）
- 嵌套 ↔ 扁平语言包互转
- GitHub Action 与 npm 发布

## License

[MIT](./LICENSE)
