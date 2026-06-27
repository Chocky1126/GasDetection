<template>
  <SimpleResourceView title="班组管理" endpoint="/teams" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'code', label: '班组编号' },
  { prop: 'name', label: '班组名称' },
  { prop: 'description', label: '说明' },
];
</script>
