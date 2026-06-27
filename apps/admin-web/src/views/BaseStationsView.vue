<template>
  <SimpleResourceView title="基站管理" endpoint="/base-stations" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'code', label: '基站编号' },
  { prop: 'name', label: '基站名称' },
  { prop: 'area.name', label: '区域' },
  { prop: 'depth', label: '深度' },
];
</script>
