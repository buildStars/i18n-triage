<script setup lang="ts">
import { ref } from 'vue'
import { showToast, showConfirmDialog } from 'vant'
import { useI18n } from 'vue-i18n'
import { STATUS_OPTIONS } from '@/constants/order'
import { logger } from '@/utils/logger'

// 订单页：这些中文注释不应该出现在报告里
/* 块注释：加载失败也不应该出现 */

const { t } = useI18n()
const list = ref<string[]>([])
const status = ref('')

/** 加载订单列表（JSDoc 里的中文同样忽略） */
async function load() {
  try {
    list.value = await fetchList()
    if (status.value === '已完成') return // 比较操作数：literal，兜底 A 待确认
    showToast('加载成功') // A：UI 提示 API
    showToast(t('已加载')) // 已接入 i18n（以中文为 key），排除
  } catch (err) {
    console.error('加载订单失败', err) // B：调试日志
    logger.warn(`重试第${retry}次`) // B：调试日志（模板字符串）
    showConfirmDialog({ title: '提示', message: '加载失败，是否重试？' }) // A：对象式调用
  }
}

const columns = { '订单号': 'orderNo', '金额': 'amount' } // D：对象 key（字符串字面量 key）
const label = columns['订单号'] // D：map 索引
</script>

<template>
  <!-- <h1>注释里的标题</h1> -->
  <div class="order-page">
    <h1 :title="'订单列表'">{{ t('订单列表标题') }}</h1>
    <van-search v-model="keyword" placeholder="请输入订单号" />
    <van-empty v-if="!list.length" description="暂无订单" />
    <ul v-else>
      <li v-for="item in list" :key="item">{{ item }} 号订单</li>
    </ul>
    <van-button type="primary" @click="load">刷新</van-button>
    <van-button @click="showToast('已复制')">复制</van-button>
    <span :class="{ '高亮': active }">{{ active ? '已选中' : '未选中' }}</span>
    <van-field label="备注" data-track="订单备注埋点" />
  </div>
</template>

<style scoped>
.order-page::after {
  content: '样式里的中文不扫';
}
</style>
