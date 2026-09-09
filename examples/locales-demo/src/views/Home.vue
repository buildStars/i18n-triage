<script setup lang="ts">
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const status = 'paid'

const paid = t('order.status.paid')
const byStatus = t(`order.status.${status}`) // 动态：前缀 order.status.
const fromVar = t(dynamicKey) // 动态：无前缀
const wrong = t('typoo') // 未定义（应为 typo）
</script>

<template>
  <div>
    <!-- $t('in.comment') 注释里的不算 -->
    <h1 :title="$t('order.title')">{{ $t('common.ok') }}</h1>
    <i18n-t keypath="hello" tag="p" />
  </div>
</template>
