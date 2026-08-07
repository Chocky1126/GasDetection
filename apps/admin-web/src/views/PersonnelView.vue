<template>
  <ResourceManagementView
    title="人员管理"
    endpoint="/personnel"
    :columns="columns"
    :fields="fields"
    :initial-values="{ teamIds: [] }"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listResource } from '../api/modules';
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField, ResourceOption } from '../components/resource-management.types';

const teamOptions = ref<ResourceOption[]>([]);
const columns: ResourceColumn[] = [
  { prop: 'code', label: '人员编号' },
  { prop: 'name', label: '姓名' },
  { prop: 'phone', label: '电话' },
  { prop: 'position', label: '岗位' },
  {
    prop: 'teams',
    label: '所属班组',
    minWidth: 180,
    formatter: (row) => row.teams?.map((item: any) => item.team?.name).filter(Boolean).join('、') || '-',
  },
];

const fields = computed<ResourceField[]>(() => [
  { prop: 'code', label: '人员编号', required: true },
  { prop: 'name', label: '姓名', required: true },
  { prop: 'phone', label: '电话' },
  { prop: 'position', label: '岗位' },
  {
    prop: 'teamIds',
    label: '所属班组',
    type: 'multi-select',
    options: teamOptions.value,
    fullWidth: true,
    valueFromRow: (row) => row.teams?.map((item: any) => item.teamId) ?? [],
  },
]);

async function loadTeams() {
  const result: any = await listResource('/teams', { page: 1, pageSize: 200 });
  const items = result.items ?? result;
  teamOptions.value = items.map((item: any) => ({ label: `${item.code} · ${item.name}`, value: item.id }));
}

onMounted(loadTeams);
</script>
