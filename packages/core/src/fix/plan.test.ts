import { parse as parseSfc } from '@vue/compiler-sfc'
import { describe, expect, it } from 'vitest'

import { parseSource } from '../parsers'
import { excludeI18nCalls, triage } from '../rules'
import type { FileContext } from '../types'
import type { FixOptions, FixPlan } from './plan'
import { planFixes } from './plan'

/** 真实链路：解析 → 剔除 i18n → 分类 → 规划修复 */
function runFix(source: string, relativePath: string, options?: FixOptions): FixPlan {
  const ctx: FileContext = { relativePath }
  const results = triage(excludeI18nCalls(parseSource(source, ctx)), ctx)
  return planFixes(source, ctx, results, options)
}

const vue = 'src/views/Order.vue'
const reasons = (plan: FixPlan) => plan.skipped.map((s) => `${s.node.value}:${s.reason}`)

describe('planFixes — template', () => {
  it('wraps text nodes in {{ $t() }} and keeps the surrounding whitespace', () => {
    const src = `<template>
  <div>
    暂无数据
  </div>
</template>`
    const plan = runFix(src, vue)
    expect(plan.output).toBe(`<template>
  <div>
    {{ $t('暂无数据') }}
  </div>
</template>`)
    expect(plan.replaced).toBe(1)
    expect([...plan.keys]).toEqual([['暂无数据', '暂无数据']])
  })

  it('handles text next to an interpolation', () => {
    const plan = runFix(`<template><li>{{ item }} 号订单</li></template>`, vue)
    expect(plan.output).toBe(`<template><li>{{ item }} {{ $t('号订单') }}</li></template>`)
  })

  it('turns a static display attribute into a bound $t() call', () => {
    const src = `<template><input placeholder="请输入订单号" confirm-button-text="确定" /></template>`
    const plan = runFix(src, vue)
    expect(plan.output).toBe(
      `<template><input :placeholder="$t('请输入订单号')" :confirm-button-text="$t('确定')" /></template>`,
    )
  })

  it('replaces the literal inside an already-bound attribute', () => {
    const plan = runFix(`<template><input :placeholder="'请输入'" /></template>`, vue)
    expect(plan.output).toBe(`<template><input :placeholder="$t('请输入')" /></template>`)
  })

  it('uses double quotes for the JS string when the attribute is single-quoted', () => {
    const plan = runFix(`<template><input :placeholder='"请输入"' /></template>`, vue)
    expect(plan.output).toBe(`<template><input :placeholder='$t("请输入")' /></template>`)
  })

  it('wraps UI API arguments inside event handlers with $t()', () => {
    const plan = runFix(`<template><b @click="showToast('已封盘')">复制</b></template>`, vue)
    expect(plan.output).toBe(
      `<template><b @click="showToast($t('已封盘'))">{{ $t('复制') }}</b></template>`,
    )
  })

  it('leaves unsure (fallback) literals alone unless includeUnsure is set', () => {
    const src = `<template><span>{{ ok ? '成功' : '失败' }}</span></template>`
    const plan = runFix(src, vue)
    expect(plan.changed).toBe(false)
    expect(reasons(plan)).toEqual(['成功:unsure', '失败:unsure'])
    const forced = runFix(src, vue, { includeUnsure: true })
    expect(forced.output).toBe(
      `<template><span>{{ ok ? $t('成功') : $t('失败') }}</span></template>`,
    )
  })

  it('never touches B / C / D results or comments', () => {
    const src = `<template>
  <!-- 注释里的中文 -->
  <div :class="{ '高亮': on }" data-track="埋点">正文</div>
</template>`
    const plan = runFix(src, vue)
    expect(plan.output).toBe(`<template>
  <!-- 注释里的中文 -->
  <div :class="{ '高亮': on }" data-track="埋点">{{ $t('正文') }}</div>
</template>`)
    expect(plan.skipped).toEqual([])
  })
})

describe('planFixes — <script setup>', () => {
  it('wraps script strings with t() and adds useI18n after the last import', () => {
    const src = `<script setup lang="ts">
import { showToast } from 'vant'

const rules = reactive({ name: [{ required: true, message: '供应商不能为空' }] })
function save() {
  showToast('保存成功')
}
</script>

<template><p>{{ title }}</p></template>`
    const plan = runFix(src, vue)
    expect(plan.output).toBe(`<script setup lang="ts">
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const rules = reactive({ name: [{ required: true, message: t('供应商不能为空') }] })
function save() {
  showToast(t('保存成功'))
}
</script>

<template><p>{{ title }}</p></template>`)
    expect(plan.replaced).toBe(2)
  })

  it('does not add useI18n twice', () => {
    const src = `<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
showToast('保存成功')
</script>`
    const plan = runFix(src, vue)
    expect(plan.output).toBe(`<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
showToast(t('保存成功'))
</script>`)
  })

  it('inserts at the top of the block when there are no imports', () => {
    const plan = runFix(`<script setup>\nshowToast('保存成功')\n</script>`, vue)
    expect(plan.output).toBe(
      `<script setup>\nimport { useI18n } from 'vue-i18n'\n\nconst { t } = useI18n()\n\nshowToast(t('保存成功'))\n</script>`,
    )
  })

  it('skips when useI18n() is used without destructuring t', () => {
    const src = `<script setup>\nconst i18n = useI18n()\nshowToast('保存成功')\n</script>`
    const plan = runFix(src, vue)
    expect(plan.changed).toBe(false)
    expect(reasons(plan)).toEqual(['保存成功:no-t-in-scope'])
  })

  it('skips concatenations and template literal chunks with a reason', () => {
    const src = `<script setup>
showToast('共' + n + '条')
showToast(\`合计\${n}元\`)
showToast('整句')
</script>`
    const plan = runFix(src, vue)
    expect(plan.output).toContain(`showToast('共' + n + '条')`)
    expect(plan.output).toContain('showToast(`合计${n}元`)')
    expect(plan.output).toContain(`showToast(t('整句'))`)
    expect(reasons(plan)).toEqual([
      '共:concatenation',
      '条:concatenation',
      '合计:template-literal',
      '元:template-literal',
    ])
  })
})

describe('planFixes — plain scripts', () => {
  it('skips options-API <script> and .ts files by default', () => {
    const optionsApi = runFix(
      `<script>\nexport default { methods: { f() { showToast('保存成功') } } }\n</script>`,
      vue,
    )
    expect(optionsApi.changed).toBe(false)
    expect(reasons(optionsApi)).toEqual(['保存成功:no-t-in-scope'])
    const ts = runFix(`showToast('保存成功')`, 'src/utils/x.ts')
    expect(ts.changed).toBe(false)
    expect(reasons(ts)).toEqual(['保存成功:no-t-in-scope'])
  })

  it('replaces them with the configured scriptFn when fixPlainScripts is on', () => {
    const plan = runFix(`showToast('保存成功')`, 'src/utils/x.ts', {
      fixPlainScripts: true,
      scriptFn: 'i18n.global.t',
    })
    expect(plan.output).toBe(`showToast(i18n.global.t('保存成功'))`)
  })

  it('skips JSX text and attributes', () => {
    const plan = runFix(`const el = <p title="属性">文本</p>`, 'src/A.tsx', {
      fixPlainScripts: true,
    })
    expect(plan.changed).toBe(false)
    expect(reasons(plan)).toEqual(['属性:jsx', '文本:jsx'])
  })
})

describe('planFixes — keys and quoting', () => {
  it('escapes single quotes in the key inside {{ }}', () => {
    const plan = runFix(`<template><p>他说'好'</p></template>`, vue)
    expect(plan.output).toBe(`<template><p>{{ $t('他说\\'好\\'') }}</p></template>`)
  })

  it('falls back to a hash key for texts with vue-i18n special characters or double quotes in attributes', () => {
    const plan = runFix(`<template><p title='说"好"'>请稍候...</p></template>`, vue)
    const out = plan.output
    expect(out).toMatch(/<p :title='\$t\("k_[0-9a-f]{8}"\)'>\{\{ \$t\('k_[0-9a-f]{8}'\) \}\}<\/p>/)
    expect(new Set(plan.keys.values())).toEqual(new Set(['请稍候...', '说"好"']))
  })

  it('reuses existing locale keys and honours the hash style', () => {
    const existing = new Map([['common.empty', '暂无数据']])
    const reuse = runFix(`<template><p>暂无数据</p></template>`, vue, { existingKeys: existing })
    expect(reuse.output).toBe(`<template><p>{{ $t('common.empty') }}</p></template>`)
    expect(reuse.keys.size).toBe(0)
    const hashed = runFix(`<template><p>暂无数据</p></template>`, vue, { keyStyle: 'hash' })
    expect(hashed.output).toMatch(/\{\{ \$t\('k_[0-9a-f]{8}'\) \}\}/)
  })

  it('lets templateFn be configured (e.g. t instead of $t)', () => {
    const plan = runFix(`<template><p>正文</p></template>`, vue, { templateFn: 't' })
    expect(plan.output).toBe(`<template><p>{{ t('正文') }}</p></template>`)
  })
})

describe('planFixes — 结果可再解析且幂等', () => {
  const src = `<script setup lang="ts">
import { showToast } from 'vant'
const rules = reactive({ name: [{ message: '不能为空' }] })
showToast('保存成功')
</script>

<template>
  <h1 title="标题">{{ ok ? '成功' : '失败' }}</h1>
  <input placeholder="请输入" />
  <p>正文</p>
</template>`

  it('produces an SFC the Vue compiler parses without errors', () => {
    const { output } = runFix(src, vue, { includeUnsure: true })
    const { errors } = parseSfc(output, { filename: vue })
    expect(errors).toEqual([])
  })

  it('leaves nothing to fix on a second pass', () => {
    const first = runFix(src, vue, { includeUnsure: true })
    // 不能为空、保存成功、标题、成功、失败、请输入、正文
    expect(first.replaced).toBe(7)
    const second = runFix(first.output, vue, { includeUnsure: true })
    expect(second.changed).toBe(false)
    expect(second.replaced).toBe(0)
    expect(second.skipped).toEqual([])
  })
})
