<template>
  <section class="calibration-page">
    <div class="toolbar">
      <h2 class="page-title">标定工作台</h2>
      <div class="toolbar-actions">
        <el-button :icon="Refresh" @click="load">刷新</el-button>
        <el-button type="primary" :icon="Plus" @click="openCreate">新增标定</el-button>
      </div>
    </div>

    <div class="metric-grid calibration-metrics">
      <div v-for="item in metricCards" :key="item.label" class="metric-card calibration-metric">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value" :style="{ color: item.color }">{{ item.value }}</div>
      </div>
    </div>

    <div class="panel filter-panel">
      <el-form :model="filters" class="calibration-filters" inline>
        <el-form-item label="关键词">
          <el-input
            v-model="filters.keyword"
            clearable
            placeholder="设备/人员"
            style="width: 220px"
            @keyup.enter="search"
          />
        </el-form-item>
        <el-form-item label="气体">
          <el-select v-model="filters.gasType" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in gasOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="结果">
          <el-select v-model="filters.result" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in resultOptions" :key="item" :label="resultText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="到期">
          <el-select v-model="filters.dueStatus" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in dueStatusOptions" :key="item" :label="dueStatusText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table
      v-loading="loading"
      :data="rows"
      class="panel calibration-table"
      height="580"
      @row-dblclick="openDetail"
    >
      <el-table-column prop="device.code" label="设备" width="128" show-overflow-tooltip />
      <el-table-column label="区域" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.device?.area?.name ?? '-' }}</template>
      </el-table-column>
      <el-table-column prop="gasType" label="气体" width="82" />
      <el-table-column prop="standardValue" label="标准值" width="96" />
      <el-table-column prop="beforeValue" label="标定前" width="96" />
      <el-table-column prop="afterValue" label="标定后" width="96" />
      <el-table-column label="偏差" width="96">
        <template #default="{ row }">{{ formatPercent(row.deviationPercent) }}</template>
      </el-table-column>
      <el-table-column label="结果" width="104">
        <template #default="{ row }">
          <el-tag :type="resultType(row.result)" effect="plain">{{ resultText(row.result) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="下次到期" width="170">
        <template #default="{ row }">{{ formatTime(row.nextDueAt) }}</template>
      </el-table-column>
      <el-table-column prop="calibratedBy" label="标定人" width="120" show-overflow-tooltip />
      <el-table-column label="班组" min-width="120" show-overflow-tooltip>
        <template #default="{ row }">{{ row.team?.name ?? row.team?.code ?? '-' }}</template>
      </el-table-column>
      <el-table-column label="操作" width="92" fixed="right">
        <template #default="{ row }">
          <el-button text :icon="View" @click="openDetail(row)">查看</el-button>
        </template>
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

    <el-dialog v-model="createDialog" title="新增标定" width="min(680px, calc(100vw - 32px))">
      <el-form :model="form" label-position="top" class="create-form">
        <div class="number-grid">
          <el-form-item label="设备">
            <el-select v-model="form.deviceId" filterable placeholder="选择设备" :loading="optionsLoading">
              <el-option
                v-for="item in deviceOptions"
                :key="item.id"
                :label="optionLabel(item, ['code', 'name'])"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="气体">
            <el-select v-model="form.gasType" placeholder="选择气体">
              <el-option v-for="item in gasOptions" :key="item" :label="item" :value="item" />
            </el-select>
          </el-form-item>
          <el-form-item label="标定时间">
            <el-date-picker
              v-model="form.calibratedAt"
              type="datetime"
              placeholder="选择时间"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="标定人">
            <el-select v-model="form.calibratedById" clearable filterable placeholder="选择人员" :loading="optionsLoading">
              <el-option
                v-for="item in personnelOptions"
                :key="item.id"
                :label="optionLabel(item, ['name', 'username'])"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="班组">
            <el-select v-model="form.teamId" clearable filterable placeholder="选择班组" :loading="optionsLoading">
              <el-option
                v-for="item in teamOptions"
                :key="item.id"
                :label="optionLabel(item, ['name', 'code'])"
                :value="item.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="标准值">
            <el-input-number v-model="form.standardValue" :precision="2" :step="0.01" style="width: 100%" />
          </el-form-item>
          <el-form-item label="标定前">
            <el-input-number v-model="form.beforeValue" :precision="2" :step="0.01" style="width: 100%" />
          </el-form-item>
          <el-form-item label="标定后">
            <el-input-number v-model="form.afterValue" :precision="2" :step="0.01" style="width: 100%" />
          </el-form-item>
        </div>
        <el-form-item label="备注">
          <el-input
            v-model="form.notes"
            type="textarea"
            :rows="4"
            maxlength="500"
            show-word-limit
            placeholder="填写标定说明"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="createDialog = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitCreate">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDrawer" title="标定详情" :size="drawerSize">
      <div v-if="selectedCalibration" class="calibration-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="设备">
            {{ selectedCalibration.device?.code ?? '-' }} {{ selectedCalibration.device?.name ?? '' }}
          </el-descriptions-item>
          <el-descriptions-item label="气体">{{ selectedCalibration.gasType }}</el-descriptions-item>
          <el-descriptions-item label="结果">{{ resultText(selectedCalibration.result) }}</el-descriptions-item>
          <el-descriptions-item label="偏差">{{ formatPercent(selectedCalibration.deviationPercent) }}</el-descriptions-item>
          <el-descriptions-item label="下次到期">{{ formatTime(selectedCalibration.nextDueAt) }}</el-descriptions-item>
          <el-descriptions-item label="标定人">{{ selectedCalibration.calibratedBy ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="班组">
            {{ selectedCalibration.team?.name ?? selectedCalibration.team?.code ?? '-' }}
          </el-descriptions-item>
          <el-descriptions-item label="备注">{{ selectedCalibration.notes ?? '-' }}</el-descriptions-item>
        </el-descriptions>
      </div>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { Plus, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { createCalibration, getCalibrationOverview, listResource } from '../api/modules';

interface CalibrationForm {
  deviceId: string;
  gasType: string;
  calibratedById: string;
  teamId: string;
  standardValue: number | null;
  beforeValue: number | null;
  afterValue: number | null;
  calibratedAt: Date | string | null;
  notes: string;
}

const rows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const optionsLoading = ref(false);
const overview = ref<any>({});
const createDialog = ref(false);
const detailDrawer = ref(false);
const selectedCalibration = ref<any>(null);
const deviceOptions = ref<any[]>([]);
const personnelOptions = ref<any[]>([]);
const teamOptions = ref<any[]>([]);
const viewportWidth = ref(currentViewportWidth());

const filters = reactive({
  keyword: '',
  gasType: '',
  result: '',
  dueStatus: '',
  page: 1,
  pageSize: 20,
});

const form = reactive<CalibrationForm>({
  deviceId: '',
  gasType: 'CH4',
  calibratedById: '',
  teamId: '',
  standardValue: 1,
  beforeValue: 1,
  afterValue: 1,
  calibratedAt: new Date(),
  notes: '',
});

const gasOptions = ['CH4', 'O2', 'CO', 'H2S'];
const resultOptions = ['PASS', 'NEED_RECHECK', 'FAIL'];
const dueStatusOptions = ['NORMAL', 'DUE_SOON', 'OVERDUE', 'FAILED'];

const metricCards = computed(() => [
  { label: '标定记录', value: overview.value.totalRecords ?? 0, color: '#2563eb' },
  { label: '今日完成', value: overview.value.todayCompleted ?? 0, color: '#16a34a' },
  { label: '即将到期', value: overview.value.dueSoonItems ?? 0, color: '#ca8a04' },
  { label: '已超期', value: overview.value.overdueItems ?? 0, color: '#ea580c' },
  { label: '需复检', value: overview.value.needRecheckRecords ?? 0, color: '#7c3aed' },
  { label: '失败', value: overview.value.failedRecords ?? 0, color: '#dc2626' },
]);

const drawerSize = computed(() => (viewportWidth.value < 640 ? '100%' : '520px'));

function currentViewportWidth() {
  return typeof window === 'undefined' ? 1024 : window.innerWidth;
}

function updateViewportWidth() {
  viewportWidth.value = currentViewportWidth();
}

function params() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined));
}

async function load() {
  loading.value = true;
  try {
    const [calibrationResult, overviewResult]: any[] = await Promise.all([
      listResource('/calibrations', params()),
      getCalibrationOverview(),
    ]);
    rows.value = calibrationResult.items ?? calibrationResult;
    total.value = calibrationResult.total ?? rows.value.length;
    overview.value = overviewResult;
  } finally {
    loading.value = false;
  }
}

async function loadOptions() {
  optionsLoading.value = true;
  try {
    const [devices, personnel, teams]: any[] = await Promise.all([
      listResource('/devices', { pageSize: 100 }),
      listResource('/personnel', { pageSize: 100 }),
      listResource('/teams', { pageSize: 100 }),
    ]);
    deviceOptions.value = devices.items ?? devices;
    personnelOptions.value = personnel.items ?? personnel;
    teamOptions.value = teams.items ?? teams;
  } catch {
    ElMessage.error('基础选项加载失败');
  } finally {
    optionsLoading.value = false;
  }
}

function search() {
  filters.page = 1;
  void load();
}

function resetFilters() {
  filters.keyword = '';
  filters.gasType = '';
  filters.result = '';
  filters.dueStatus = '';
  search();
}

function handleSizeChange() {
  filters.page = 1;
  void load();
}

function openCreate() {
  Object.assign(form, {
    deviceId: '',
    gasType: 'CH4',
    calibratedById: '',
    teamId: '',
    standardValue: 1,
    beforeValue: 1,
    afterValue: 1,
    calibratedAt: new Date(),
    notes: '',
  });
  createDialog.value = true;
}

function openDetail(row: any) {
  selectedCalibration.value = row;
  detailDrawer.value = true;
}

async function submitCreate() {
  if (!form.deviceId || !form.gasType || !form.calibratedAt) {
    ElMessage.warning('请填写设备、气体和标定时间');
    return;
  }
  const numbers = validateCalibrationValues();
  if (!numbers) return;

  const calibratedAt = new Date(form.calibratedAt);
  if (!Number.isFinite(calibratedAt.getTime())) {
    ElMessage.warning('请选择有效的标定时间');
    return;
  }

  submitting.value = true;
  try {
    await createCalibration({
      deviceId: form.deviceId,
      gasType: form.gasType,
      calibratedById: form.calibratedById || undefined,
      teamId: form.teamId || undefined,
      standardValue: numbers.standardValue,
      beforeValue: numbers.beforeValue,
      afterValue: numbers.afterValue,
      calibratedAt: calibratedAt.toISOString(),
      notes: form.notes || undefined,
    });
    createDialog.value = false;
    ElMessage.success('标定记录已创建');
    await load();
  } finally {
    submitting.value = false;
  }
}

function validateCalibrationValues() {
  const standardValue = finiteNumber(form.standardValue);
  const beforeValue = finiteNumber(form.beforeValue);
  const afterValue = finiteNumber(form.afterValue);

  if (standardValue === null || beforeValue === null || afterValue === null) {
    ElMessage.warning('请填写有效的标定数值');
    return null;
  }
  if (standardValue <= 0) {
    ElMessage.warning('标准值必须大于 0');
    return null;
  }
  if (beforeValue < 0 || afterValue < 0) {
    ElMessage.warning('标定前和标定后不能小于 0');
    return null;
  }
  return { standardValue, beforeValue, afterValue };
}

function finiteNumber(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function resultText(result: string) {
  return ({ PASS: '合格', NEED_RECHECK: '需复检', FAIL: '失败' } as Record<string, string>)[result] ?? result;
}

function dueStatusText(status: string) {
  return ({ NORMAL: '正常', DUE_SOON: '即将到期', OVERDUE: '已超期', FAILED: '异常' } as Record<string, string>)[status] ?? status;
}

function resultType(result: string) {
  return ({ PASS: 'success', NEED_RECHECK: 'warning', FAIL: 'danger' } as Record<string, string>)[result] ?? 'info';
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

function formatPercent(value?: number) {
  return typeof value === 'number' ? `${value.toFixed(2)}%` : '-';
}

function optionLabel(item: any, fields: string[]) {
  return fields.map((field) => item[field]).filter(Boolean).join(' / ') || item.id;
}

onMounted(() => {
  updateViewportWidth();
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateViewportWidth);
  }
  void load();
  void loadOptions();
});

onBeforeUnmount(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateViewportWidth);
  }
});
</script>

<style scoped>
.calibration-page {
  min-width: 0;
}

.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.calibration-metrics {
  grid-template-columns: repeat(6, minmax(120px, 1fr));
}

.calibration-metric {
  min-height: 106px;
}

.filter-panel {
  margin-bottom: 14px;
}

.calibration-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.calibration-table {
  padding: 0;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 0 0;
}

.create-form {
  min-width: 0;
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0 14px;
}

.calibration-detail {
  display: grid;
  gap: 18px;
}

@media (max-width: 1100px) {
  .calibration-metrics {
    grid-template-columns: repeat(3, minmax(120px, 1fr));
  }

  .number-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .calibration-metrics {
    grid-template-columns: 1fr;
  }

  .toolbar {
    align-items: flex-start;
    gap: 10px;
    flex-direction: column;
  }

  .toolbar-actions,
  .toolbar-actions .el-button {
    width: 100%;
  }

  .pagination-bar {
    justify-content: flex-start;
    overflow-x: auto;
  }
}
</style>
