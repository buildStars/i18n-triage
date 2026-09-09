# examples

## locales-demo

`i18n-triage locales` 的 fixture：两种语言包布局（`zh-CN.json` 与 `zh-CN/menu.json`）、JSON 与 TS 模块、应被跳过的 `index.ts`、`Home.vue` 里的静态 / 动态 / 未定义引用、`router.ts` 里存在 `meta.title` 的 key。
期望：源语言 9 个 key；en-US 缺 3 多 1 空 1；死 key 2（`common.unused`、`typo`），`order.status.pending` 可能被动态使用，`common.cancel` 可能通过字面量引用，`typoo` 未定义。

```bash
pnpm triage locales examples/locales-demo
```

## demo

一个故意混入四类情况的迷你 Vue 项目，每个中文都在源码里用注释标明了期望分类：

| 文件                     | 覆盖的情况                                                                                                                      |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `src/views/Order.vue`    | 文本节点、静态 / 绑定属性、`{{ }}` 与 `@click` 里的调用、`t()` 剔除、console / logger、对象 key、map 索引、HTML 注释、`<style>` |
| `src/constants/order.ts` | options 数组字典（C）、数值 key 映射表（C）、中文标识符 key（D）、单个 value 兜底（A 待确认）                                   |
| `src/enums/pay.ts`       | enum 成员（D）、enums/ 目录下的映射表（C）                                                                                      |
| `src/utils/logger.ts`    | 各种调试 API 实参（B）、正则字面量（忽略）                                                                                      |
| `src/utils/toast.ts`     | 项目自封装的 `myToast`，通过 `i18n-triage.config.mjs` 的 `uiApis` 配成 A                                                        |
| `src/components/Tip.tsx` | JSX 文本与属性                                                                                                                  |
| `node_modules/` `dist/`  | 默认排除，里面的中文不应出现                                                                                                    |

期望结果（`packages/cli/src/scan.test.ts` 以此为断言）：6 个文件，A 21（其中 3 处待确认）/ B 8 / C 13 / D 11，剔除 i18n 调用 2 处。
（`data-track` 属性归 D；`{ text: '无备注' }` 因属性名是展示 prop 而成为规则命中的 A。）

在仓库根目录运行（`demo/i18n-triage.config.mjs` 会被自动发现）：

```bash
pnpm triage examples/demo
pnpm triage examples/demo --only all
pnpm triage examples/demo --format json --out /tmp/report.json
```
