<template>
  <ResourceManagementView
    title="区域管理"
    endpoint="/areas"
    :columns="columns"
    :fields="fields"
    :initial-values="{ riskLevel: 1 }"
  />
</template>

<script setup lang="ts">
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField, ResourceTagType } from '../components/resource-management.types';

function riskTag(level: number): ResourceTagType {
  if (level >= 5) return 'danger';
  if (level === 4) return 'warning';
  if (level === 3) return 'primary';
  return level === 2 ? 'success' : 'info';
}

const columns: ResourceColumn[] = [
  { prop: 'code', label: '区域编号' },
  { prop: 'name', label: '区域名称' },
  {
    prop: 'riskLevel',
    label: '风险等级',
    width: 120,
    tag: (row) => ({ text: `L${row.riskLevel}`, type: riskTag(row.riskLevel) }),
  },
  { prop: 'lng', label: '经度', width: 130 },
  { prop: 'lat', label: '纬度', width: 130 },
  { prop: 'description', label: '说明', minWidth: 200 },
];

const fields: ResourceField[] = [
  { prop: 'code', label: '区域编号', required: true },
  { prop: 'name', label: '区域名称', required: true },
  { prop: 'riskLevel', label: '风险等级', type: 'number', required: true, min: 1, max: 5 },
  { prop: 'lng', label: '经度', type: 'number', required: true, step: 0.000001, precision: 6 },
  { prop: 'lat', label: '纬度', type: 'number', required: true, step: 0.000001, precision: 6 },
  { prop: 'description', label: '说明', type: 'textarea', fullWidth: true },
];
</script>
