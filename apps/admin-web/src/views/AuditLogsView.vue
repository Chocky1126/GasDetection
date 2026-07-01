<template>
  <section class="audit-page">
    <div class="toolbar">
      <h2 class="page-title">操作日志</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="panel audit-filter-panel">
      <el-form :model="filters" class="audit-filters" inline>
        <el-form-item label="模块">
          <el-select v-model="filters.module" clearable placeholder="全部" style="width: 156px">
            <el-option v-for="item in moduleOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="动作">
          <el-select v-model="filters.action" clearable placeholder="全部" style="width: 156px">
            <el-option v-for="item in actionOptions" :key="item.value" :label="item.label" :value="item.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="用户/详情/模块" style="width: 240px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table v-loading="loading" :data="rows" class="panel audit-table" height="620">
      <el-table-column label="用户" width="132" show-overflow-tooltip>
        <template #default="{ row }">{{ row.user?.name ?? row.user?.username ?? '系统' }}</template>
      </el-table-column>
      <el-table-column label="模块" width="130">
        <template #default="{ row }">
          <el-tag effect="plain">{{ moduleText(row.module) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="动作" width="150">
        <template #default="{ row }">
          <el-tag :type="actionType(row.action)" effect="plain">{{ actionText(row.action) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="resourceId" label="资源" width="190" show-overflow-tooltip />
      <el-table-column prop="detail" label="详情" min-width="360" show-overflow-tooltip />
      <el-table-column label="时间" width="180">
        <template #default="{ row }">{{ formatTime(row.createdAt) }}</template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="filters.page"
        v-model:page-size="filters.pageSize"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="load"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import { Refresh, Search } from '@element-plus/icons-vue';
import { onMounted, reactive, ref } from 'vue';
import { listResource } from '../api/modules';

const rows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);

const filters = reactive({
  module: '',
  action: '',
  keyword: '',
  page: 1,
  pageSize: 20,
});

const moduleOptions = [
  { label: '报警中心', value: 'alarms' },
  { label: '标定记录', value: 'calibrations' },
  { label: '设备管理', value: 'devices' },
  { label: '用户管理', value: 'users' },
  { label: '角色管理', value: 'roles' },
];

const actionOptions = [
  { label: '确认报警', value: 'ACK' },
  { label: '解除报警', value: 'RESOLVE' },
  { label: '新增', value: 'CREATE' },
  { label: '标定告警', value: 'CALIBRATION_WARNING' },
  { label: '更新', value: 'UPDATE' },
  { label: '删除', value: 'DELETE' },
];

function params() {
  return {
    module: filters.module || undefined,
    action: filters.action || undefined,
    keyword: filters.keyword || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
  };
}

async function load() {
  loading.value = true;
  try {
    const result: any = await listResource('/audit-logs', params());
    rows.value = result.items ?? result;
    total.value = result.total ?? rows.value.length;
  } finally {
    loading.value = false;
  }
}

function search() {
  filters.page = 1;
  void load();
}

function resetFilters() {
  filters.module = '';
  filters.action = '';
  filters.keyword = '';
  filters.page = 1;
  void load();
}

function handleSizeChange() {
  filters.page = 1;
  void load();
}

function moduleText(module: string) {
  return (
    {
      alarms: '报警中心',
      calibrations: '标定记录',
      devices: '设备管理',
      users: '用户管理',
      roles: '角色管理',
    } as Record<string, string>
  )[module] ?? module;
}

function actionText(action: string) {
  return (
    {
      ACK: '确认报警',
      RESOLVE: '解除报警',
      CREATE: '新增',
      CALIBRATION_WARNING: '标定告警',
      UPDATE: '更新',
      DELETE: '删除',
    } as Record<string, string>
  )[action] ?? action;
}

function actionType(action: string) {
  return (
    {
      ACK: 'warning',
      RESOLVE: 'success',
      CREATE: 'primary',
      CALIBRATION_WARNING: 'danger',
      UPDATE: 'info',
      DELETE: 'danger',
    } as Record<string, string>
  )[action] ?? 'info';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

onMounted(load);
</script>

<style scoped>
.audit-page {
  min-width: 0;
}

.audit-filter-panel {
  margin-bottom: 14px;
}

.audit-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.audit-table {
  padding: 0;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 0 0;
}

@media (max-width: 720px) {
  .toolbar,
  .pagination-bar {
    align-items: stretch;
    flex-direction: column;
  }
}
</style>
