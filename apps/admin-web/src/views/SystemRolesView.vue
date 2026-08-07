<template>
  <ResourceManagementView
    title="角色管理"
    endpoint="/roles"
    search-placeholder="输入角色名称或说明"
    :columns="columns"
    :fields="fields"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listResource } from '../api/modules';
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField, ResourceOption } from '../components/resource-management.types';

const permissionOptions = ref<ResourceOption[]>([]);
const moduleLabels: Record<string, string> = {
  dashboard: '首页',
  devices: '设备管理',
  monitor: '实时监测',
  'alarm-rules': '报警规则',
  alarms: '报警中心',
  personnel: '人员管理',
  teams: '班组管理',
  areas: '区域管理',
  'base-stations': '基站管理',
  calibrations: '标定记录',
  'audit-logs': '操作日志',
  users: '用户管理',
  roles: '角色管理',
};

const columns: ResourceColumn[] = [
  { prop: 'name', label: '角色' },
  { prop: 'description', label: '说明', minWidth: 180 },
  {
    prop: 'permissions',
    label: '权限数',
    width: 100,
    formatter: (row) => String(row.permissions?.length ?? 0),
  },
  {
    prop: 'createdAt',
    label: '创建时间',
    minWidth: 180,
    formatter: (row) => new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false }),
  },
];

const fields = computed<ResourceField[]>(() => [
  { prop: 'name', label: '角色名称', required: true },
  { prop: 'description', label: '角色说明' },
  {
    prop: 'permissionIds',
    label: '分配权限',
    type: 'multi-select',
    options: permissionOptions.value,
    fullWidth: true,
    valueFromRow: (row) => row.permissions?.map((item: any) => item.permission?.id).filter(Boolean) ?? [],
  },
]);

async function loadPermissions() {
  const result: any = await listResource('/roles/permissions');
  const items = result.items ?? result;
  permissionOptions.value = items.map((item: any) => ({
    label: `${moduleLabels[item.module] ?? item.module} · ${item.name}`,
    value: item.id,
  }));
}

onMounted(loadPermissions);
</script>
