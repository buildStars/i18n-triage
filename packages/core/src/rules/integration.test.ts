import { describe, expect, it } from 'vitest'

import { parseSource } from '../parsers'
import type { FileContext, TriageResult } from '../types'
import { excludeI18nCalls, triage } from './index'

/** 端到端：源码 → 解析 → 剔除 i18n 调用 → 分类 */
function run(source: string, relativePath: string) {
  const ctx: FileContext = { relativePath }
  const nodes = parseSource(source, ctx)
  const kept = excludeI18nCalls(nodes)
  return {
    excluded: nodes.length - kept.length,
    results: triage(kept, ctx),
  }
}

const brief = (r: TriageResult) => `${r.category} ${r.node.value} (${r.matchedBy})`

describe('端到端：views/Order.vue', () => {
  const src = `<script setup lang="ts">
import { showToast } from 'vant'
import { useI18n } from 'vue-i18n'
// 注释：已封盘
const { t } = useI18n()
const STATUS = { '已封盘': 1, label: '联盟' }
enum Mode { Fast = '快速' }
function save() {
  console.error('加载失败')
  showToast(t('已封盘'))
  showToast('保存成功')
  ElMessage({ message: '对象式提示', type: 'error' })
  const tip = '裸字面量'
}
</script>

<template>
  <!-- <p>注释里的元素</p> -->
  <h1 title="标题">{{ t('页面标题') }}</h1>
  <input placeholder="请输入订单号" data-track="埋点名" />
  <p>暂无数据</p>
  <van-button @click="showToast('点击了')">按钮</van-button>
</template>

<style scoped>
h1::after { content: '样式中文'; }
</style>`

  const { excluded, results } = run(src, 'src/views/Order.vue')

  it('excludes the two t() calls before classification', () => {
    expect(excluded).toBe(2)
  })

  it('classifies every remaining string exactly as the rule table says', () => {
    expect(results.map(brief)).toEqual([
      'D_INTERNAL_KEY 已封盘 (d-internal-key)', // { '已封盘': 1 }
      'A_UI_TEXT 联盟 (fallback)', // { label: '联盟' } in a view, 1 sibling → not a dict
      'D_INTERNAL_KEY 快速 (d-internal-key)', // enum member
      'B_DEBUG_LOG 加载失败 (b-debug-log)', // console.error
      'A_UI_TEXT 保存成功 (a-ui-text)', // showToast('...')
      'A_UI_TEXT 对象式提示 (a-ui-text)', // ElMessage({ message })
      'A_UI_TEXT 裸字面量 (fallback)',
      'A_UI_TEXT 标题 (a-ui-text)', // title="标题"
      'A_UI_TEXT 请输入订单号 (a-ui-text)', // placeholder
      'A_UI_TEXT 埋点名 (fallback)', // data-track: not whitelisted → conservative A
      'A_UI_TEXT 暂无数据 (a-ui-text)', // text node
      'A_UI_TEXT 点击了 (a-ui-text)', // @click="showToast('点击了')"
      'A_UI_TEXT 按钮 (a-ui-text)', // text node
    ])
  })

  it('never surfaces comments or <style> content', () => {
    const values = results.map((r) => r.node.value)
    expect(values.some((v) => v.includes('注释'))).toBe(false)
    expect(values.some((v) => v.includes('样式'))).toBe(false)
  })
})

describe('端到端：constants/lottery.ts', () => {
  const src = `// 彩种字典
export const COLOR_MAP = { '红波': 1, '蓝波': 2, '绿波': 3 }
export const COLOR_OPTIONS = [
  { label: '红波', value: 1 },
  { label: '蓝波', value: 2 },
  { label: '绿波', value: 3 },
]
export const STATUS_TEXT = { 0: '待开奖', 1: '已开奖', 2: '已封盘' }
export const SINGLE = { label: '只有一个' }
console.log('字典加载完成')`

  const { excluded, results } = run(src, 'src/constants/lottery.ts')

  it('has nothing to exclude', () => {
    expect(excluded).toBe(0)
  })

  it('keys are D, option/map values are C, a lone value falls back to A, logs are B', () => {
    expect(results.map(brief)).toEqual([
      'D_INTERNAL_KEY 红波 (d-internal-key)',
      'D_INTERNAL_KEY 蓝波 (d-internal-key)',
      'D_INTERNAL_KEY 绿波 (d-internal-key)',
      'C_DICT 红波 (c-dict)',
      'C_DICT 蓝波 (c-dict)',
      'C_DICT 绿波 (c-dict)',
      'C_DICT 待开奖 (c-dict)',
      'C_DICT 已开奖 (c-dict)',
      'C_DICT 已封盘 (c-dict)',
      'A_UI_TEXT 只有一个 (fallback)',
      'B_DEBUG_LOG 字典加载完成 (b-debug-log)',
    ])
  })
})

describe('端到端：同一份对象在 views/ 下不是字典', () => {
  it('reports the same options list as A when the file is not under a dict directory', () => {
    const src = `export const COLOR_OPTIONS = [{ label: '红波', value: 1 }, { label: '蓝波', value: 2 }, { label: '绿波', value: 3 }]`
    const { results } = run(src, 'src/views/lottery.ts')
    expect(results.map((r) => r.category)).toEqual(['A_UI_TEXT', 'A_UI_TEXT', 'A_UI_TEXT'])
    expect(results.every((r) => r.matchedBy === 'fallback')).toBe(true)
  })
})
