<template>
  <ResourceManagementView title="基站管理" endpoint="/base-stations" :columns="columns" :fields="fields" />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listResource } from '../api/modules';
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField, ResourceOption } from '../components/resource-management.types';

const areaOptions = ref<ResourceOption[]>([]);
const columns: ResourceColumn[] = [
  { prop: 'code', label: '基站编号' },
  { prop: 'name', label: '基站名称' },
  { prop: 'area.name', label: '所属区域', minWidth: 150 },
  { prop: 'lng', label: '经度', width: 130 },
  { prop: 'lat', label: '纬度', width: 130 },
  { prop: 'depth', label: '井下深度', width: 120, formatter: (row) => `${row.depth} m` },
];

const fields = computed<ResourceField[]>(() => [
  { prop: 'code', label: '基站编号', required: true },
  { prop: 'name', label: '基站名称', required: true },
  { prop: 'areaId', label: '所属区域', type: 'select', required: true, options: areaOptions.value },
  { prop: 'depth', label: '井下深度（米）', type: 'number', required: true, min: 0, step: 1, precision: 1 },
  { prop: 'lng', label: '经度', type: 'number', required: true, step: 0.000001, precision: 6 },
  { prop: 'lat', label: '纬度', type: 'number', required: true, step: 0.000001, precision: 6 },
]);

async function loadAreas() {
  const result: any = await listResource('/areas', { page: 1, pageSize: 200 });
  const items = result.items ?? result;
  areaOptions.value = items.map((item: any) => ({ label: `${item.code} · ${item.name}`, value: item.id }));
}

onMounted(loadAreas);
</script>
