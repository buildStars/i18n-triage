# i18n-triage — 项目约定（每次新会话先读这里）

## 项目定位

i18n 硬编码文案审计工具。**核心差异化：按调用点上下文对硬编码中文做语义分类，而不是全量报警。**

现有工具（i18n-ally、eslint-plugin-i18n、各类 i18n-scanner）用正则或粗粒度 AST 找中文字符然后全部报出来。
真实项目上误报率极高：扫到 10000+ 处中文，其中约 80% 是中文注释、4% 是 console 日志、2% 是对象 key，
真正需要翻译的 UI 文案只占约 2%。

i18n-triage 把字符串按 **AST 位置 + 调用点上下文** 分成四类，只把「必翻译 UI 文案」推到用户面前。
报告里的「降噪比」（扫到 N 处 → A 类 M 处）是这个项目的核心卖点。

### 为什么必须用 AST 而不是正则（技术立足点）

正则分不清：

| 写法                                                     | 正确分类                     | 正则看到的      |
| -------------------------------------------------------- | ---------------------------- | --------------- |
| `{ '联盟': 1 }` vs `{ label: '联盟' }`                   | D（key）vs A（value）        | 都是 `'联盟'`   |
| `t('已封盘')` vs `showToast('已封盘')`                   | 已接入（跳过）vs A（未接入） | 都是 `'已封盘'` |
| `// 已封盘` vs `"已封盘"`                                | 忽略 vs 需分类               | 都是 `已封盘`   |
| `constants/lottery.ts` vs `views/Order.vue` 里同样的对象 | C（字典）vs A                | 无目录概念      |

## 四类分类规则表（领域知识，后续会话必读）

| 类                   | 判定依据                                                                                                                                                                                                                                                                                                     | 处置                                                 |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| **A 必翻译 UI 文案** | ① template 文本节点 ② 白名单展示属性（`placeholder` / `title` / `label` / `alt` / `confirm-button-text` / `cancel-button-text` / `description` / `empty-text`）③ UI 提示 API 实参（`showToast` / `showDialog` / `showConfirmDialog` / `Notify` / `ElMessage` / `ElMessageBox` / `message.*` / `$message.*`） | 主战场，报出来                                       |
| **B 调试日志**       | `console.*` / `logger.*` / `devLogger.*` / `debug.*` / 裸 `log()` 的实参                                                                                                                                                                                                                                     | 归档，默认不报                                       |
| **C 数据字典**       | 位于 `constants/` `enum/` `enums/` `dict/` 目录（任意层级），且是对象字面量的 value，且同一对象内 ≥3 个中文 value（阈值可配）                                                                                                                                                                                | 单独成组报出，提示「走配置化翻译表，不要逐句抽 key」 |
| **D 内部键**         | ① 对象字面量的 key 位置 ② enum 成员 ③ 被用作 map 索引                                                                                                                                                                                                                                                        | 归档，默认不报                                       |
| **忽略**             | 注释（`//` `/* */` `<!-- -->`）、`<style>` 块、import/export 路径、正则字面量                                                                                                                                                                                                                                | 完全跳过，不进入分类                                 |

### 规则执行顺序（引擎）

规则按数组顺序串行，**第一个命中者胜出**。默认优先级 `[B, D, C, A]`：
先排除明确不需要翻译的（B 调试日志、D 内部键），再判定 C 字典，最后 A 兜底。

- `console.error('加载失败')` 同时满足 B 和 A（都是 call-arg），必须 B 先命中。
- `constants/lottery.ts` 里 `{ '红波': 1 }` 同时可能满足 D 和 C，D（key）优先。
- 没有任何规则命中的节点 → 归为 `A_UI_TEXT`（保守策略：宁可让用户多看，不漏真正的 UI 文案），`matchedBy: 'fallback'`。

白名单与阈值全部抽到 `packages/core/src/rules/defaults.ts`，不要硬编码在规则函数里。

## 技术选型（已定，不要改）

| 用途                   | 选型                                                                                                                                                                                         |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.vue` 拆块            | `@vue/compiler-sfc` 的 `parse()`                                                                                                                                                             |
| template → AST         | `@vue/compiler-dom` 的原始 parse AST。实际取 `descriptor.template.ast`（compiler-sfc 已调用 compiler-dom 解析，且位置是整文件坐标），不再二次 `compile()`，理由见 `docs/vue-template-ast.md` |
| 模板表达式里的字符串   | TypeScript parser（`ts-morph` 导出的 `ts`），见 `parsers/expression.ts`                                                                                                                      |
| script / `.ts` / `.js` | `ts-morph`（`createSourceFile` 从字符串创建，不用 `addSourceFileAtPath`）                                                                                                                    |
| 测试                   | vitest                                                                                                                                                                                       |
| 包管理 / 任务编排      | pnpm workspace + Turborepo                                                                                                                                                                   |
| 构建                   | tsdown（ESM）                                                                                                                                                                                |
| 语言                   | TypeScript 严格模式                                                                                                                                                                          |
| 终端着色               | picocolors（不用 chalk 5）                                                                                                                                                                   |

**不要用 tree-sitter**：多语言支持对本项目无用，且引入二进制依赖。

## 目录职责

```
i18n-triage/
├── packages/
│   ├── core/          # 解析 + 分类引擎。零 IO 纯函数
│   │   └── src/
│   │       ├── types.ts        # 核心类型：StringNode / Category / Rule / TriageResult
│   │       ├── utils/chinese.ts# 中文检测正则，全仓库唯一定义处
│   │       ├── utils/line-index.ts # 整文件 offset → 行列，所有解析器共用
│   │       ├── parsers/        # vue-sfc.ts（template）/ expression.ts（模板表达式）/ script.ts（ts-morph）
│   │       └── rules/          # a-ui-text / b-debug-log / c-dict / d-internal-key / engine / defaults
│   ├── cli/           # 命令行入口 + 配置加载 + 文件发现。所有 IO 只在这里
│   └── reporters/     # text / json / sarif / html 格式化器，纯函数，不写文件
├── internal/
│   ├── eslint-config/ # 共享 ESLint flat config；含 noNodeIo() 禁止 core 引入 IO 模块
│   └── tsconfig/      # 共享 TS 配置：base.json / library.json / node.json
├── examples/          # 示例项目（Day 6 demo）
├── docs/              # AST 对照表、判定表等设计文档
├── CLAUDE.md
├── pnpm-workspace.yaml
├── turbo.json
└── package.json
```

包名统一带 scope：`@i18n-triage/core` / `@i18n-triage/cli` / `@i18n-triage/reporters`。
开发期各包的 `main` / `exports` 直接指向 `src/index.ts`，发布时由 `publishConfig` 切到 `dist/`。

## 分层原则（硬约束）

- **`core` 零 IO 纯函数**：禁止 `fs` / `path` 读写 / `process` / `child_process` 等一切 Node IO 模块（含 `node:` 前缀），禁止 `process` 全局。
  ESLint 通过 `noNodeIo(['packages/core/src/**/*.ts'])` 强制。解析器入参是**源码字符串**，不是文件路径。
- **所有 IO 只在 `cli`**：读文件、glob、加载配置、写报告。
- `reporters` 只做 `TriageResult[] → string`，不写文件。
- 规则签名固定为 `types.ts` 里的 `Rule`，不要改类型定义去迁就实现。

## 编码规范

- TypeScript 严格模式（`strict` + `noUncheckedIndexedAccess` + `verbatimModuleSyntax` 等，见 `internal/tsconfig/base.json`）。
- **禁止 `any`**；必要时用 `unknown` + 类型守卫。
- **禁止 `@ts-ignore`**；用 `@ts-expect-error` 并写明原因（≥6 字符说明）。
- 函数优先纯函数：同样输入同样输出，不依赖外部状态。
- 类型导入用 `import type`（ESLint `consistent-type-imports` 强制）。
- **中文检测正则统一用 `/[一-鿿㐀-䶿]/`**，唯一定义在 `packages/core/src/utils/chinese.ts`（导出 `CHINESE_RE` 与 `containsChinese()`），**禁止在其他地方重复写**。
- 格式：prettier，无分号、单引号、宽度 100。

## 解析器约定（Day 2–3 已定，规则层依赖这些语义）

对外 API（全部纯函数，见 `packages/core/src/parsers/index.ts`）：

- `parseSource(source, ctx)` 按后缀分派：`.vue` → `parseVueSfc`，其余 → `parseScript`。CLI 只调这一个。
- `parseVueSfc` = template 节点 + 每个 `<script>` / `<script setup>` 块，按 offset 排序。script 块的做法是**把整文件里块以外的字符遮罩成空格（保留换行）再整段解析**，所以位置天然是整文件坐标，没有任何偏移加减。
- `parseScript(source, ctx, { dialect? })`：`.ts` / `.tsx` / `.js` / `.jsx` 按后缀选方言，`.vue` 按 `<script lang>`。

kind 判定的关键语义（详表见 `docs/ts-morph-kinds.md`、`docs/vue-template-ast.md`）：

- **透明层**：括号、`as` / `satisfies` / `!`、模板字符串静态段、三元分支、`+` / `??` / `||` 拼接都不改变字面量的位置语义。`showToast(ok ? '成功' : '失败')` 两个都是 `call-arg`。比较运算符（`===` 等）不透明，`status === '已封盘'` 是 `literal`。
- **`calleeName` 取最近的调用**：`showToast(t('已封盘'))` 里是 `t`。回调函数体是边界：`list.map(x => x.label + '元')` 的 `'元'` 不属于 `map`。
- **非 call-arg 也可能带 `calleeName`**：`showToast({ message: '已封盘' })` 的 `object-value` 带 `calleeName: 'showToast'`（沿对象 / 数组 / 属性向上找到把它当实参的调用）。A / B 规则应同时检查 `call-arg` 和带 `calleeName` 的 `object-value`。
- **`siblingChineseCount` 对数组元素对象按整个数组合计**：`[{ label: '待支付' }, { label: '已支付' }, { label: '已取消' }]` 每个 label 都是 3。这是 options 列表这种最常见字典形态能被 C 规则命中的前提。数组属性 `{ tags: ['一', '二'] }` 的元素算 `object-value`，逐个计数。不递归进嵌套对象。
- **`object-key` 还包括 map 索引**：`dict['联盟']`、`dict?.['键']`（规则表 D ③）、计算属性名 `['键']: 1`、类成员名。
- **JSX**：`JsxText` → `template-text`，JSX 属性 → `template-attr`（含 `attr={'字面量'}`），`{'花括号文本'}` → `literal`。
- **完全跳过**：注释、import/export/动态 import/require 路径、正则、字符串字面量类型（`type S = '已封盘'`、`Record<'键', X>`）、接口成员名、`declare module '…'`。
- **位置**：统一指向 AST 节点起点（字符串 → 引号；模板 middle/tail → `}`；文本节点 → 第一个非空白字符），`offset` 相对整个文件，行列由 `utils/line-index.ts` 从 offset 反查。

## 测试规范

- **每条规则必须有 fixture 测试**，并有一组专门的**优先级冲突测试**（同时满足两条规则的节点，断言最终分类）。
- **`core` 的测试不允许读真实文件**；fixture 一律用内联源码字符串。
- 解析器测试必须单独断言：注释排除（`<!-- -->`、`//`、`/* */`）、位置信息（line / column / offset 相对整个文件）。
- 测试文件与源码同目录，命名 `*.test.ts`。
- 遵循 TDD：先写失败的测试，再写实现。

## 提交规范

Conventional Commits：`feat(core): ...` / `fix(cli): ...` / `test(core): ...` / `docs: ...` / `chore: ...`。
scope 用包名短名（`core` / `cli` / `reporters` / `eslint-config` / `tsconfig`）。每个阶段完成即提交。

## 常用命令

```bash
pnpm install
pnpm test                 # turbo run test（各包 vitest run）
pnpm typecheck            # turbo run typecheck
pnpm lint                 # eslint .
pnpm build                # turbo run build（tsdown）
pnpm --filter @i18n-triage/core test:watch
pnpm --filter @i18n-triage/cli dev <dir>   # 直接跑 CLI 源码
```

## 开发进度

| 阶段    | 内容                                                                              | 状态 |
| ------- | --------------------------------------------------------------------------------- | ---- |
| Day 1   | 仓库骨架 + CLAUDE.md + 核心类型 + smoke 测试                                      | ✅   |
| Day 2   | `parsers/vue-sfc.ts`（先产出 NodeTypes 对照表到 `docs/vue-template-ast.md`）      | ✅   |
| Day 3   | `parsers/script.ts`（先产出 ts-morph 判定表到 `docs/ts-morph-kinds.md`）          | ✅   |
| Day 4-5 | `rules/` 四条规则 + engine + defaults + 优先级测试                                | ⬜   |
| Day 6   | cli + text/json reporter + `examples/demo`                                        | ⬜   |
| Day 7   | 跑真实开源项目、统计准确率、README                                                | ⬜   |
| 后续    | SARIF reporter、`--fix` 抽 key、语言包完整度 / 死 key 检测、GitHub Action、发 npm | ⬜   |
