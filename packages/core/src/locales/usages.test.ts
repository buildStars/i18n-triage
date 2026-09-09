import { describe, expect, it } from 'vitest'

import type { FileContext } from '../types'
import { findKeyUsages } from './usages'

const ts: FileContext = { relativePath: 'src/utils/x.ts' }
const vue: FileContext = { relativePath: 'src/views/Home.vue' }

describe('findKeyUsages — script', () => {
  it('collects the first string argument of i18n calls with its location', () => {
    const src = `const a = t('common.ok')
const b = i18n.global.t("order.title")
const c = this.$t('hello')
const d = tc('apples', 3)`
    const { static: keys, dynamic } = findKeyUsages(src, ts)
    expect(keys.map((k) => [k.key, k.calleeName, k.loc.line])).toEqual([
      ['common.ok', 't', 1],
      ['order.title', 'i18n.global.t', 2],
      ['hello', 'this.$t', 3],
      ['apples', 'tc', 4],
    ])
    expect(keys[0]?.loc).toMatchObject({ file: 'src/utils/x.ts', column: 13, offset: 12 })
    expect(dynamic).toEqual([])
  })

  it('ignores non-i18n calls and non-first string arguments', () => {
    const src = `showToast('common.ok'); t('key', 'fallback text'); format(t('a.b'))`
    const { static: keys } = findKeyUsages(src, ts)
    expect(keys.map((k) => k.key)).toEqual(['key', 'a.b'])
  })

  it('records dynamic keys with their static prefix when there is one', () => {
    const src =
      'const a = t(`order.status.${status}`); const b = t(key); const c = t(prefix + ".x")'
    const { static: keys, dynamic } = findKeyUsages(src, ts)
    expect(keys).toEqual([])
    expect(dynamic.map((d) => [d.prefix, d.calleeName])).toEqual([
      ['order.status.', 't'],
      [undefined, 't'],
      [undefined, 't'],
    ])
  })

  it('accepts a no-substitution template literal as a static key', () => {
    const { static: keys } = findKeyUsages('t(`common.ok`)', ts)
    expect(keys.map((k) => k.key)).toEqual(['common.ok'])
  })

  it('honours a custom callee list', () => {
    const { static: keys } = findKeyUsages(`translate('x.y'); t('ignored')`, ts, {
      callees: ['translate'],
    })
    expect(keys.map((k) => k.key)).toEqual(['x.y'])
  })

  it('never reports strings inside comments', () => {
    expect(findKeyUsages(`// t('in.comment')\n/* $t('also') */`, ts).static).toEqual([])
  })

  it('collects every other string literal so keys stored in data (route meta, menus) can be matched', () => {
    const src = `export const routes = [{ path: '/login', meta: { title: 'router.login' } }]
const months = ['analysis.january', 'analysis.february']
t('common.ok')`
    const { literals } = findKeyUsages(src, ts)
    expect(literals).toEqual([
      '/login',
      'router.login',
      'analysis.january',
      'analysis.february',
      'common.ok',
    ])
  })
})

describe('findKeyUsages — .vue', () => {
  const src = `<script setup lang="ts">
import { useI18n } from 'vue-i18n'
const { t } = useI18n()
const title = t('order.title')
const s = t(\`order.status.\${status}\`)
</script>

<template>
  <!-- $t('in.comment') -->
  <h1 :title="$t('common.ok')">{{ $t('hello') }}</h1>
  <i18n-t keypath="greeting" tag="p" />
  <p v-t="'directive.key'" />
</template>`

  it('collects keys from script, template expressions and <i18n-t keypath>', () => {
    const { static: keys, dynamic } = findKeyUsages(src, vue)
    expect(keys.map((k) => `${k.key}@${k.loc.line}`)).toEqual([
      'order.title@4',
      'common.ok@10',
      'hello@10',
      'greeting@11',
      'directive.key@12',
    ])
    expect(dynamic.map((d) => d.prefix)).toEqual(['order.status.'])
  })

  it('includes static attribute values in literals', () => {
    const { literals } = findKeyUsages(
      `<template><menu-item title="router.login" /></template>`,
      vue,
    )
    expect(literals).toContain('router.login')
  })

  it('reports whole-file offsets for template usages', () => {
    const { static: keys } = findKeyUsages(src, vue)
    const ok = keys.find((k) => k.key === 'common.ok')
    expect(ok?.loc.offset).toBe(src.indexOf(`'common.ok'`))
    const greeting = keys.find((k) => k.key === 'greeting')
    expect(greeting?.loc.offset).toBe(src.indexOf(`"greeting"`))
  })
})
