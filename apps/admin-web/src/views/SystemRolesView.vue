<template>
  <SimpleResourceView title="角色管理" endpoint="/roles" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'name', label: '角色' },
  { prop: 'description', label: '说明' },
  { prop: 'createdAt', label: '创建时间' },
];
</script>
