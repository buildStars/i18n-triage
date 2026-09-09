# i18n-triage

**Find the hard-coded Chinese strings in a Vue / TypeScript codebase that actually need translating — and only those.**

Existing scanners grep for CJK characters and report everything. i18n-triage parses the real AST (`@vue/compiler-sfc` + `ts-morph`), looks at _where_ each string sits and _who_ consumes it, and sorts strings into four buckets. Only bucket A — text a user will see — lands in front of you.

[中文版 README](./README.zh-CN.md) · [Validation report](./docs/validation.md)

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

Real numbers from four real projects (details, sampling and misclassification log in [docs/validation.md](./docs/validation.md)):

| Project                                                                              | Files | Regex hits |      A (to translate) | B logs | C dicts | D keys | Noise removed |
| ------------------------------------------------------------------------------------ | ----: | ---------: | --------------------: | -----: | ------: | -----: | ------------: |
| [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)                           | 1,337 |      9,899 |    2,514 (336 unsure) |      8 |       0 |     86 |         74.6% |
| [vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin) |    77 |         28 |                     4 |      3 |       0 |      0 |         85.7% |
| [yudao-ui-admin-vue3](https://github.com/yudaocode/yudao-ui-admin-vue3)              | 2,602 |     97,118 | 29,235 (3,122 unsure) |    233 |     319 |     16 |         69.9% |
| [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3)                            |   166 |      4,739 |    2,691 (167 unsure) |      2 |       6 |      1 |         43.2% |

Manual review of equidistant samples: **60 of 64 sampled A items are unambiguous UI text, 4 are borderline, 0 are wrong** (93.8%–100% precision). B, C and D samples were 100% correct after the fixes described in the validation report. RuoYi has no i18n at all, so its "noise" floor is legitimately low — almost everything there really is UI text.

## The problem

Run any regex-based i18n scanner on a mature Chinese admin project and you get five-digit numbers. On yudao-ui-admin-vue3 a `/[一-鿿]+/` grep reports **97,118** fragments. Of those, **67,313 (69%) are comments, import paths, regexes and other things that never reach a screen**, 233 are `console.*` calls, 319 are dictionary tables that should be translated as a whole, and 16 are object keys. Nobody triages a 97k-line list by hand, so the list gets ignored and the hard-coded strings stay.

## Four buckets

| Bucket                | Decided by                                                                                                                                                                                                                                                                                     | What happens                                                             |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A — UI text**       | ① template text nodes ② display attributes / props (`placeholder`, `title`, `label`, `alt`, `confirm-button-text`, `*-text`, `*-placeholder`, `{ message }`, `{ label }` …) ③ arguments of UI APIs (`showToast`, `ElMessage`, `message.*`, `$modal.*`, `h`, `notification[type]`, zod `z.*` …) | reported, per file                                                       |
| **B — debug logs**    | arguments of `console.*`, `logger.*`, `devLogger.*`, `debug.*`, `log`                                                                                                                                                                                                                          | archived, hidden                                                         |
| **C — dictionaries**  | object values in `constants/`, `consts/`, `enum(s)/`, `dict/` (or a file named like that) with ≥ 3 Chinese values in the same object / options array                                                                                                                                           | reported per file, with a "translate the table, don't extract keys" hint |
| **D — internal keys** | object keys, enum members, map indexes, and values of identity attributes (`id`, `class`, `key`, `ref`, `name`, `fill`, `stroke`, `data-*` …)                                                                                                                                                  | archived, hidden                                                         |
| _(ignored)_           | comments (`//`, `/* */`, `<!-- -->`), `<style>`, import/export paths, regex literals, string literal types, JSDoc                                                                                                                                                                              | never enter the pipe                                                     |

Rules run in the order **B → D → C → A**; the first match wins. Strings no rule claims fall back to A and are flagged `待确认` (unsure) so nothing user-facing is silently dropped. Arguments of `t()` / `$t()` / `*.t` are removed before classification — they are already translated.

## Why an AST, not a regex

A regex sees the same four characters; the AST sees four different things:

| Code                                                                 | Regex sees    | i18n-triage sees                                       |
| -------------------------------------------------------------------- | ------------- | ------------------------------------------------------ |
| `{ '联盟': 1 }` vs `{ label: '联盟' }`                               | `'联盟'` ×2   | **D** object key vs **A** value of a display prop      |
| `t('已封盘')` vs `showToast('已封盘')`                               | `'已封盘'` ×2 | already translated (excluded) vs **A** UI-API argument |
| `// 已封盘` vs `"已封盘"`                                            | `已封盘` ×2   | nothing vs a string node                               |
| the same options list in `constants/lottery.ts` vs `views/Order.vue` | identical     | **C** dictionary vs **A** UI text                      |

Template expressions get the same treatment: `{{ t('已封盘') }}` is a `call-arg` of `t` and is excluded, while `@click="showToast('已封盘')"` is a `call-arg` of `showToast` and is A — the expression is handed to the TypeScript parser with the rest of the `.vue` file masked out, so kinds, callee names and whole-file positions are exact.

## Install and use

Not on npm yet. From a clone:

```bash
pnpm install
pnpm triage path/to/your/project              # text report, A + C
pnpm triage path/to/your/project --only all   # all four buckets
pnpm triage path/to/your/project --format json --out report.json
```

Or build the standalone binary:

```bash
pnpm --filter @i18n-triage/cli build
node packages/cli/dist/bin.js path/to/your/project
```

Options:

```
i18n-triage [...paths]

  --format <text|json|sarif>   default text; sarif is ready for GitHub Code Scanning
  --only <letters>       e.g. A,C (default) or all
  --config <path>        default: i18n-triage.config.{ts,mts,js,mjs,cjs,json} in cwd, then in the scanned directory
  --out <path>           write the report to a file
  --no-color
```

Exit code is 1 when some files failed to parse (they are listed at the end of the report), 2 on a fatal error.

### Configuration

```ts
// i18n-triage.config.ts
import { defineConfig } from '@i18n-triage/cli'

export default defineConfig({
  // Lists are appended to the built-in defaults; set extendDefaults: false to replace them.
  uiApis: ['myToast', 'tipText', '$tab.*'], // project-specific prompt helpers
  displayAttrs: ['tip-text'], // extra display props / attributes
  debugApis: ['Sentry.*'],
  dictDirs: ['dictionaries'],
  dictSiblingThreshold: 3,
  internalAttrs: ['track-*'], // attributes whose values are never text
  i18nCallees: ['translate'], // already-translated calls to exclude
  ignore: ['**/legacy/**'], // added to node_modules / dist / locales / mock / tests / *.min.js …
  maxFileSize: 300_000, // larger files are skipped as generated
  only: 'A,C',
  format: 'text',
})
```

Pattern syntax: `showToast` exact · `console.*` any non-final segment · `*.t` final segment · `*-text` attribute suffix · `data-*` attribute prefix.

## Architecture

```
                 ┌──────────────────────── @i18n-triage/core (pure, zero IO) ────────────────────────┐
 source string ─►│ parsers/                    rules/                                              │
                 │  vue-sfc  ──┐                excludeI18nCalls ─► triage([B, D, C, A], fallback A)│─► TriageResult[]
                 │  script   ──┼─► StringNode[] ─┘                                                  │
                 │  expression─┘   (kind · calleeName · attrName · siblingChineseCount · loc)       │
                 └───────────────────────────────────────────────────────────────────────────────────┘
                          ▲                                                              │
   @i18n-triage/cli       │ readFile                                                     ▼
   discover (glob) ───────┘                                    @i18n-triage/reporters: buildScanReport → text | json
```

- **`core`** never touches the file system: parsers take source strings, rules take `StringNode`s. An ESLint rule (`noNodeIo`) fails the build if anything under `packages/core` imports `fs`, `path`, `process`, etc.
- **Rules are plain functions** `(node, ctx) => Category | null` with a name. Swap the chain, add your own, or configure the defaults via `createDefaultRules(config)`.
- **`.vue` files are parsed once** with `@vue/compiler-sfc`; template positions come straight from `descriptor.template.ast` in whole-file coordinates, and `<script>` blocks / template expressions are handed to `ts-morph` with everything else masked to spaces, so no offset arithmetic anywhere.
- **`reporters`** turn `TriageResult[]` into text or JSON; **`cli`** owns all IO.

Design notes: [docs/vue-template-ast.md](./docs/vue-template-ast.md), [docs/ts-morph-kinds.md](./docs/ts-morph-kinds.md).

## Known limitations

- Object keys that are later rendered as headings (`{ '置顶': [], '今天': [] }`) are D by definition — check D once if your codebase does this.
- `new Error('…')` messages, export file names (`download.excel(data, '报表.xls')`) and `{ name: '…' }` values stay in the unsure part of A: whether they are user-visible depends on the project.
- Project-specific prompt helpers (`tipText()`, `requiredRule()`) are not guessed — add them to `uiApis`.

## Roadmap

- `--fix`: extract A strings into a locale file and replace them with `t('key')`
- Locale completeness check and dead-key detection
- SARIF output for GitHub Code Scanning (inline PR annotations)
- Nested ↔ flat locale conversion
- GitHub Action and npm release

## License

[MIT](./LICENSE)
