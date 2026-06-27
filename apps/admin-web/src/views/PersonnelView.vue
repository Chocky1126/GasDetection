<template>
  <SimpleResourceView title="人员管理" endpoint="/personnel" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'code', label: '人员编号' },
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '电话' },
  { prop: 'position', label: '岗位' },
];
</script>
