<template>
  <SimpleResourceView title="操作日志" endpoint="/audit-logs" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'user.username', label: '用户' },
  { prop: 'module', label: '模块' },
  { prop: 'action', label: '动作' },
  { prop: 'detail', label: '详情' },
  { prop: 'createdAt', label: '时间' },
];
</script>
