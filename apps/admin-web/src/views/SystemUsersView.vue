<template>
  <ResourceManagementView
    title="用户管理"
    endpoint="/users"
    search-placeholder="输入用户名、姓名、电话或邮箱"
    :columns="columns"
    :fields="fields"
    :initial-values="{ roleIds: [], isEnabled: true }"
    :to-payload="toPayload"
  />
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { listResource } from '../api/modules';
import ResourceManagementView from '../components/ResourceManagementView.vue';
import type { ResourceColumn, ResourceField, ResourceMode, ResourceOption } from '../components/resource-management.types';

const roleOptions = ref<ResourceOption[]>([]);
const columns: ResourceColumn[] = [
  { prop: 'username', label: '用户名' },
  { prop: 'name', label: '姓名' },
  {
    prop: 'roles',
    label: '角色',
    minWidth: 180,
    formatter: (row) => row.roles?.map((item: any) => item.role?.description || item.role?.name).filter(Boolean).join('、') || '-',
  },
  { prop: 'phone', label: '电话', minWidth: 140 },
  { prop: 'email', label: '邮箱', minWidth: 180 },
  {
    prop: 'isEnabled',
    label: '状态',
    width: 100,
    tag: (row) => ({ text: row.isEnabled ? '启用' : '停用', type: row.isEnabled ? 'success' : 'info' }),
  },
];

const fields = computed<ResourceField[]>(() => [
  { prop: 'username', label: '用户名', required: true },
  { prop: 'name', label: '姓名', required: true },
  {
    prop: 'password',
    label: '密码',
    type: 'password',
    requiredOnCreate: true,
    placeholder: '编辑时留空表示不修改',
  },
  { prop: 'phone', label: '电话' },
  { prop: 'email', label: '邮箱' },
  { prop: 'isEnabled', label: '账号状态', type: 'switch', activeText: '启用', inactiveText: '停用' },
  {
    prop: 'roleIds',
    label: '分配角色',
    type: 'multi-select',
    options: roleOptions.value,
    fullWidth: true,
    valueFromRow: (row) => row.roles?.map((item: any) => item.role?.id).filter(Boolean) ?? [],
  },
]);

function toPayload(form: Record<string, any>, mode: ResourceMode) {
  const payload = { ...form };
  if (mode === 'edit' && !payload.password) delete payload.password;
  return payload;
}

async function loadRoles() {
  const result: any = await listResource('/roles', { page: 1, pageSize: 200 });
  const items = result.items ?? result;
  roleOptions.value = items.map((item: any) => ({ label: item.description || item.name, value: item.id }));
}

onMounted(loadRoles);
</script>
