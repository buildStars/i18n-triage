# examples

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

期望结果（`packages/cli/src/scan.test.ts` 以此为断言）：6 个文件，A 22（其中 5 处待确认）/ B 8 / C 13 / D 10，剔除 i18n 调用 2 处。

在仓库根目录运行（`demo/i18n-triage.config.mjs` 会被自动发现）：

```bash
pnpm triage examples/demo
pnpm triage examples/demo --only all
pnpm triage examples/demo --format json --out /tmp/report.json
```
