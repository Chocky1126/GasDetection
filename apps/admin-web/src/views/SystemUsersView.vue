<template>
  <SimpleResourceView title="用户管理" endpoint="/users" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'username', label: '用户名' },
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '电话' },
  { prop: 'isEnabled', label: '启用' },
];
</script>
