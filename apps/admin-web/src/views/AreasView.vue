<template>
  <SimpleResourceView title="区域管理" endpoint="/areas" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'code', label: '区域编号' },
  { prop: 'name', label: '区域名称' },
  { prop: 'riskLevel', label: '风险等级' },
  { prop: 'description', label: '说明' },
];
</script>
