<template>
  <ResourceManagementView title="班组管理" endpoint="/teams" :columns="columns" :fields="fields" />
</template>

<script setup lang="ts">
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField } from '../components/resource-management.types';

const columns: ResourceColumn[] = [
  { prop: 'code', label: '班组编号' },
  { prop: 'name', label: '班组名称' },
  { prop: 'members', label: '成员数', width: 110, formatter: (row) => String(row.members?.length ?? 0) },
  { prop: 'description', label: '说明', minWidth: 220 },
];

const fields: ResourceField[] = [
  { prop: 'code', label: '班组编号', required: true },
  { prop: 'name', label: '班组名称', required: true },
  { prop: 'description', label: '说明', type: 'textarea', fullWidth: true },
];
</script>
