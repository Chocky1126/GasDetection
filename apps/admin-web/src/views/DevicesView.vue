<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">设备管理</h2>
      <el-button type="primary" @click="openCreate">新增设备</el-button>
    </div>
    <el-table :data="rows" class="panel">
      <el-table-column prop="code" label="设备编码" width="130" />
      <el-table-column prop="name" label="设备名称" min-width="180" />
      <el-table-column prop="model" label="型号" width="120" />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="snapshot.ch4" label="CH4" width="90" />
      <el-table-column prop="snapshot.o2" label="O2" width="90" />
      <el-table-column prop="snapshot.co" label="CO" width="90" />
      <el-table-column prop="snapshot.h2s" label="H2S" width="90" />
      <el-table-column prop="snapshot.batteryLevel" label="电量" width="90" />
      <el-table-column label="操作" width="120">
        <template #default="{ row }">
          <el-button text @click="openEdit(row)">编辑</el-button>
        </template>
      </el-table-column>
    </el-table>
    <el-drawer v-model="drawer" title="设备信息" size="420px">
      <el-form :model="form" label-position="top">
        <el-form-item label="设备编码"><el-input v-model="form.code" /></el-form-item>
        <el-form-item label="设备名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="型号"><el-input v-model="form.model" /></el-form-item>
        <el-form-item label="序列号"><el-input v-model="form.serialNumber" /></el-form-item>
      </el-form>
      <div v-if="editingId" class="device-calibrations">
        <h3>最近标定</h3>
        <el-table :data="calibrationRows" size="small" height="220">
          <el-table-column prop="gasType" label="气体" width="70" />
          <el-table-column label="结果" width="90">
            <template #default="{ row }">
              <el-tag :type="calibrationResultType(row.result)" effect="plain">
                {{ calibrationResultText(row.result) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="偏差" width="80">
            <template #default="{ row }">{{ formatDeviation(row.deviationPercent) }}</template>
          </el-table-column>
          <el-table-column prop="calibratedBy" label="标定人" width="100" show-overflow-tooltip />
          <el-table-column label="时间" min-width="150">
            <template #default="{ row }">{{ formatTime(row.calibratedAt) }}</template>
          </el-table-column>
        </el-table>
      </div>
      <el-button type="primary" @click="save">保存</el-button>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue';
import { createResource, getDeviceCalibrations, listResource, updateResource } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const rows = ref<any[]>([]);
const calibrationRows = ref<any[]>([]);
const drawer = ref(false);
const editingId = ref('');
const form = reactive({ code: '', name: '', model: 'GD4-MINE', serialNumber: '' });

async function load() {
  const result: any = await listResource('/devices', { pageSize: 100 });
  rows.value = result.items ?? result;
}

async function loadCalibrations(id: string) {
  const result: any = await getDeviceCalibrations(id, { pageSize: 5 });
  calibrationRows.value = result.items ?? result;
}

function openCreate() {
  editingId.value = '';
  calibrationRows.value = [];
  Object.assign(form, { code: '', name: '', model: 'GD4-MINE', serialNumber: '' });
  drawer.value = true;
}

function openEdit(row: any) {
  editingId.value = row.id;
  Object.assign(form, row);
  void loadCalibrations(row.id);
  drawer.value = true;
}

async function save() {
  if (editingId.value) {
    await updateResource('/devices', editingId.value, form);
  } else {
    await createResource('/devices', form);
  }
  drawer.value = false;
  await load();
}

function calibrationResultText(result: string) {
  return ({ PASS: '合格', NEED_RECHECK: '需复检', FAIL: '失败' } as Record<string, string>)[result] ?? result;
}

function calibrationResultType(result: string) {
  return ({ PASS: 'success', NEED_RECHECK: 'warning', FAIL: 'danger' } as Record<string, string>)[result] ?? 'info';
}

function formatDeviation(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '-';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

watch(() => realtime.latestSnapshot, () => load());
onMounted(load);
</script>

<style scoped>
.device-calibrations {
  margin: 18px 0;
}

.device-calibrations h3 {
  margin: 0 0 10px;
  font-size: 15px;
}
</style>
