# 真实项目验证（Day 7）

> 所有数字都是用本仓库当前代码实际跑出来的，命令与被测 commit 见文末「复现」。日期：2026-09-09。

## 被测项目

| 项目                                                                                 | commit    | 日期       | 扫描文件数 | 特点                                                       |
| ------------------------------------------------------------------------------------ | --------- | ---------- | ---------: | ---------------------------------------------------------- |
| [vue-vben-admin](https://github.com/vbenjs/vue-vben-admin)                           | `3f2d8bc` | 2026-09-07 |      1,337 | i18n 完备的 monorepo；硬编码中文集中在 playground / 示例页 |
| [vue-element-plus-admin](https://github.com/kailong321200875/vue-element-plus-admin) | `9047610` | 2026-09-01 |         77 | 小型模板，i18n 完备                                        |
| [yudao-ui-admin-vue3](https://github.com/yudaocode/yudao-ui-admin-vue3)              | `aab14fb` | 2026-09-05 |      2,602 | 大型 ERP / CRM / HRM 后台，大量硬编码中文，部分接入 i18n   |
| [RuoYi-Vue3](https://github.com/yangzongzhuan/RuoYi-Vue3)                            | `838965c` | 2026-08-26 |        166 | 完全没有 i18n，几乎所有中文都是 UI 文案（JS，非 TS）       |

## 最终结果

| 项目                   | 正则口径（扫到） | A 必翻译 | 其中待确认 | B 日志 | C 字典 | D 内部键 | 注释等忽略 | 噪音占比 | 跳过文件 |
| ---------------------- | ---------------: | -------: | ---------: | -----: | -----: | -------: | ---------: | -------: | -------: |
| vue-vben-admin         |            9,899 |    2,514 |        336 |      8 |      0 |       86 |      7,291 |    74.6% |        1 |
| vue-element-plus-admin |               28 |        4 |          0 |      3 |      0 |        0 |         21 |    85.7% |        0 |
| yudao-ui-admin-vue3    |           97,118 |   29,235 |      3,122 |    233 |    319 |       16 |     67,313 |    69.9% |        2 |
| RuoYi-Vue3             |            4,739 |    2,691 |        167 |      2 |      6 |        1 |      2,039 |    43.2% |        0 |

「正则口径」= `/[一-鿿㐀-䶿]+/g` 的匹配数，即一个正则式扫描器会报出的数量；「噪音占比」= 1 − A / 正则口径。
「待确认」是 A 里没有任何规则命中、按保守策略兜底进 A 的条目（非白名单属性、裸字面量、未知调用的实参）。

两点解读：

- **i18n 越完备的项目噪音越高**。vben 的 9,899 处正则命中里 7,291 处是注释，真正需要人看的是 2,514 处，且几乎全部落在 playground / docs 的演示页面（`useVbenForm` 的 schema label、echarts 配置、演示用的假数据）。
- **RuoYi 完全没有 i18n，43% 的噪音已经是下限**——剩下的 2,691 处几乎都是真正要翻译的模板文本和 `label=` 属性。这类项目上工具的价值不在「降噪」而在分类：`console.warn`、`class="支付宝信息"`、`dict/` 目录下的 options 列表被分开了。

## 抽样复核

方法：对每个项目的 A 类按 offset 顺序**等距抽样 20 条**（避免只看文件头部），B / C / D 各 10 条（不足则全量），人工判断分类是否正确。
判定口径：A 必须是最终会渲染给用户看的文案；B 是调试输出；C 是字典 value；D 是键 / 标识。

### A 必翻译 UI 文案

| 项目                   | 抽样 | 正确 | 存疑 | 错误 | 存疑条目                                                                                                                            |
| ---------------------- | ---: | ---: | ---: | ---: | ----------------------------------------------------------------------------------------------------------------------------------- |
| vue-vben-admin         |   20 |   18 |    2 |    0 | `backend-mock` 中间件返回的 `'演示环境，禁止修改'`（mock 服务的响应文案）；drawer 演示里的 `payload: '外部传递的数据 payload'`      |
| vue-element-plus-admin |    4 |    4 |    0 |    0 | （全量 4 条）                                                                                                                       |
| yudao-ui-admin-vue3    |   20 |   18 |    2 |    0 | `api/crm/business/status/index.ts` 里 `{ key: '结束' }`；`new Error('适用部门和适用员工不能同时为空')`（抛出后由全局 message 展示） |
| RuoYi-Vue3             |   20 |   20 |    0 |    0 |                                                                                                                                     |
| **合计**               |   64 |   60 |    4 |    0 | 精确率 93.8%（存疑全算错）～ 100%（存疑全算对）                                                                                     |

抽样明细（yudao 的 20 条，其余见 `scratchpad` 复现脚本输出）：

```
src/api/crm/business/status/index.ts:21                object-value  key          "结束"                      存疑
.../penal/listeners/ProcessListenerDialog.vue:6         template-attr label        "名字"                      ✓
src/views/ai/workflow/index.vue:70                      template-attr label        "流程名称"                  ✓
src/views/crm/contact/index.vue:64                      template-attr placeholder  "请输入微信"                ✓
.../FinanceReceiptItemForm.vue:62                       template-text              "+ 添加销售退货单"          ✓
src/views/erp/stock/warehouse/index.vue:66              template-attr label        "仓库地址"                  ✓
.../AttendanceClockDailyDetail.vue:56                   literal                    "每日考勤详情"              ✓（待确认档）
.../assessment/detail/index.vue:47                      template-attr label        "周期范围"                  ✓
.../SalaryGroupForm.vue:108                             call-arg      Error        "适用部门和适用员工不能同时为空" 存疑
src/views/im/manager/message/group/index.vue:63         template-attr label        "群"                        ✓
.../DeviceModbusConfigForm.vue:16                       template-attr label        "端口"                      ✓
src/views/mall/product/spu/index.vue:184                template-text              "详情"                      ✓
.../pickUpOrder/index.vue:86                            template-text              "连接扫描枪"                ✓
src/views/mes/dv/repair/RepairLineList.vue:12           template-attr label        "故障图片"                  ✓
.../RouteProductBomList.vue:21                          template-attr label        "BOM 物料名称"              ✓
src/views/mes/wm/arrivalnotice/index.vue:15             template-attr label        "通知单编号"                ✓
.../ReturnIssueLineList.vue:32                          template-attr label        "规格型号"                  ✓
src/views/mp/user/index.vue:25                          template-attr label        "昵称"                      ✓
.../ProjectOverview.vue:33                              template-text              "查看全部公告"              ✓
src/views/system/sms/channel/index.vue:49               template-text              "重置"                      ✓
```

### B / C / D

| 类别 | 项目                | 抽样 | 正确 | 备注                                                                                                                                       |
| ---- | ------------------- | ---: | ---: | ------------------------------------------------------------------------------------------------------------------------------------------ |
| B    | vue-vben-admin      |    8 |    8 | 全部 `console.warn` / `console.error`                                                                                                      |
| B    | yudao-ui-admin-vue3 |   10 |   10 | `console.*`，含 `[IM UserInfo] 删除好友失败` 这类带模块前缀的日志                                                                          |
| B    | RuoYi-Vue3          |    2 |    2 |                                                                                                                                            |
| C    | yudao-ui-admin-vue3 |   10 |   10 | `views/*/utils/constants.ts`、`SimpleProcessDesignerV2/src/consts.ts` 里 options 列表的 label                                              |
| C    | RuoYi-Vue3          |    6 |    6 | `system/dict/data.vue` 里的标签类型 options                                                                                                |
| D    | vue-vben-admin      |   10 |   10 | `slogan.vue` 里设计工具导出的 SVG 图层名：`id="矩形备份-4"`、`id="编组-11备份"`                                                            |
| D    | yudao-ui-admin-vue3 |   10 |    9 | 1 错：`data-placeholder="按 Enter 发送，Shift+Enter 换行"` 是展示文案（第二轮已修：D 规则对展示属性模式放行）；`{ '置顶': [] }` 见下方局限 |
| D    | RuoYi-Vue3          |    1 |    1 | `class="支付宝信息"`                                                                                                                       |

## 误判清单与处置

第一轮扫描（Day 6 的规则）在 vben 上 A 类 2,643 处里有 1,745 处待确认，element-plus-admin 92 处 A 里 87 处来自 `locales/zh-CN.ts`。按「AST 判定有 bug / 需要新增规则 / 需要调白名单」整理：

### AST / CLI 判定有 bug

| 现象                                                                | 根因                                           | 处置                                                                                                       |
| ------------------------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `loc.file` 出现 `../../AppData/.../vue-vben-admin/...`              | 相对路径以 cwd 为基准，扫描 cwd 外的目录时上翻 | 基准按目标选：目标在 cwd 之下相对 cwd，否则相对目标目录；永不出现 `../`                                    |
| `{ 待支付: 0 }` 这种中文**标识符** key 完全没被扫到                 | 解析器只看字符串字面量                         | `Identifier` 在 PropertyAssignment / EnumMember / PropertyAccess 的 name 位置时报 object-key / enum-member |
| yudao 里 `Tinyflow/ui/index.umd.js`（单行 19 万字符）贡献 100+ 条 A | vendored 打包产物被当源码扫                    | 任一行 > 5,000 字符 → `minified`；整体 > 300 KB → `too-large`；记入 `report.skipped`                       |

### 需要新增规则

| 现象                                                                                      | 处置                                                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| vben `slogan.vue` 86 条 A：`id="矩形"`、`fill="url(#线性渐变)"`、`stroke=...`             | D 规则新增「非展示属性」：id / class / key / ref / name / fill / stroke / d / href / src / style / data-\* → D                    |
| yudao 1,616 条待确认来自 `reactive({ rules: { name: [{ message: '供应商不能为空' }] } })` | object-value 记录所属属性名 `attrName`；A 规则把 `{ label / message / title / placeholder / … }` 判为规则命中的 A（不再是待确认） |
| `data-placeholder="按 Enter 发送"` 被 D 抢走                                              | D 的内部属性匹配对展示属性模式放行（`exceptAttrs` 默认 = 展示属性列表）                                                           |

### 需要调白名单

| 现象                                                                                                                           | 处置                                                                                                                                             |
| ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `start-placeholder` ×206、`end-placeholder` ×206、`active-text` ×31、`table-title` ×5 …                                        | 属性名支持后缀模式 `*-text` `*-title` `*-placeholder` `*-tooltip` `*-label` `*-description` `*-message` `*-tip(s)` `*-help` `*-hint` `*-content` |
| `header` ×47、`desc`、`hint`、`help` ×19、`unit` ×11、`range-separator`、antd `addonAfter` / `checkedChildren`                 | 加入展示属性精确名                                                                                                                               |
| RuoYi `proxy.$modal.msgSuccess(...)` ×66、`proxy.$modal.confirm(...)` ×50                                                      | UI API 加 `$modal.*` / `*.$modal`                                                                                                                |
| vben `notification[type]({ message })`、`Modal.confirm({...})`、`h('span', '文案')`、zod `z.string().min(1, '请输入')`         | callee 的 `X[]` 视同 `X.*`；UI API 加 `notification(.*)` `Modal(.*)` `modal.*` `dialog.*` TDesign `MessagePlugin.*` 等、`h`、`z.*`               |
| yudao `SimpleProcessDesignerV2/src/consts.ts` 121 条 A 其实是字典                                                              | 字典目录加 `consts` / `const`（该文件 86 条转为 C）                                                                                              |
| element-plus-admin 92 条 A 里 87 条来自 `src/locales/zh-CN.ts`；yudao 404 条来自同名文件、234 条来自 bpmn 的 `translate/zh.js` | CLI 默认排除翻译表：`**/locales/**` `**/locale/**` `**/lang(s)/**` `**/i18n/**` `**/translations/**` `**/translate/**` `**/zh-CN.*` `**/zh.*` …  |
| vben `*.test.ts` 里 `it('应该…')`、element-plus-admin `mock/user/index.mock.ts`                                                | 默认排除 `**/__tests__/**` `**/*.test.*` `**/*.spec.*` `**/mock(s)/**` `**/__mocks__/**`                                                         |

### 修复前后

| 项目                   | 第一轮 A（待确认） | 修复后 A（待确认） | 说明                                                       |
| ---------------------- | ------------------ | ------------------ | ---------------------------------------------------------- |
| vue-vben-admin         | 2,643（1,745）     | 2,514（336）       | 86 条 SVG 图层名转 D；测试 / mock 文件不再扫；待确认降 81% |
| vue-element-plus-admin | 92（90）           | 4（0）             | 翻译表不再扫                                               |
| yudao-ui-admin-vue3    | 30,161（6,942）    | 29,235（3,122）    | 翻译表 / 打包产物不再扫；`consts.ts` 转 C；待确认降 55%    |
| RuoYi-Vue3             | 2,692（496）       | 2,691（167）       | `$modal.*`、`{ title / label }` 转为规则命中；待确认降 66% |

## 已知局限（保留为待确认或已知偏差）

- **被当成标题展示的 key**：yudao `ConversationList.vue` 里 `{ '置顶': [], '今天': [], '一天前': [] }` 的 key 之后被渲染成分组标题。按规则表它是 D（对象 key）——这是规则表定义的取舍，不是 bug，但用户需要知道 D 里可能藏着这类文案。
- **抛出的 Error 消息**（yudao 156 条 `new Error('中文')`）：是否展示给用户取决于全局错误处理，工具无法判断，保留在待确认。
- **文件名 / 导出名**（yudao 149 条 `download.excel(data, '报表.xls')`）：用户可见但通常不走 i18n，保留待确认。
- **`{ name: '中文' }`**（vben 105、yudao 606 条待确认）：`name` 既可能是图表系列名（展示）也可能是内部标识，故意不进展示属性列表。
- **项目自定义的提示函数**（yudao `tipText()`、`requiredRule()`，RuoYi `proxy.$tab.openPage()`）：通过配置 `uiApis` 追加即可，工具不猜。

## 复现

```bash
# 在仓库根目录
pnpm install && pnpm --filter i18n-triage build

git clone --depth 1 https://github.com/vbenjs/vue-vben-admin.git /tmp/vben
node packages/cli/dist/bin.js /tmp/vben --only all --format json --out /tmp/vben.json
node packages/cli/dist/bin.js /tmp/vben          # 文本报告

# 其余三个同理：
#   https://github.com/kailong321200875/vue-element-plus-admin
#   https://github.com/yudaocode/yudao-ui-admin-vue3
#   https://github.com/yangzongzhuan/RuoYi-Vue3
```

抽样脚本（等距抽样 + 按规则 / kind / 属性名 / 被调用者分组统计）见提交历史里 Day 7 的说明；核心逻辑只是对 JSON 报告的 `results` 做分组与 `Math.floor(i * length / n)` 取样。
