<template>
  <section class="alarm-page">
    <div class="toolbar">
      <h2 class="page-title">报警中心</h2>
      <el-button :icon="Refresh" @click="load">刷新</el-button>
    </div>

    <div class="metric-grid alarm-metrics">
      <div v-for="item in metricCards" :key="item.label" class="metric-card alarm-metric">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value" :style="{ color: item.color }">{{ item.value }}</div>
      </div>
    </div>

    <div class="panel alarm-filter-panel">
      <el-form :model="filters" class="alarm-filters" inline>
        <el-form-item label="状态">
          <el-select v-model="filters.status" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in statusOptions" :key="item" :label="statusText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="等级">
          <el-select v-model="filters.severity" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in severityOptions" :key="item" :label="severityText(item)" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="气体">
          <el-select v-model="filters.gasType" clearable placeholder="全部" style="width: 132px">
            <el-option v-for="item in gasOptions" :key="item" :label="item" :value="item" />
          </el-select>
        </el-form-item>
        <el-form-item label="关键词">
          <el-input v-model="filters.keyword" clearable placeholder="设备/内容" style="width: 220px" @keyup.enter="search" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" :icon="Search" @click="search">查询</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </div>

    <el-table v-loading="loading" :data="rows" class="panel alarm-table" height="580" @row-dblclick="openDetail">
      <el-table-column prop="device.code" label="设备" width="128" />
      <el-table-column prop="gasType" label="气体" width="88" />
      <el-table-column label="等级" width="104">
        <template #default="{ row }">
          <el-tag :type="severityType(row.severity)" effect="plain">{{ severityText(row.severity) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="104">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="plain">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="value" label="当前值" width="96" />
      <el-table-column prop="thresholdValue" label="阈值" width="96" />
      <el-table-column label="升级" width="96">
        <template #default="{ row }">
          <el-tag v-if="row.escalationLevel > 0" type="danger">已升级</el-tag>
          <span v-else class="muted">-</span>
        </template>
      </el-table-column>
      <el-table-column prop="message" label="报警内容" min-width="260" show-overflow-tooltip />
      <el-table-column label="时间" width="170">
        <template #default="{ row }">{{ formatTime(row.startedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="228" fixed="right">
        <template #default="{ row }">
          <el-button text :icon="View" @click="openDetail(row)">查看</el-button>
          <el-button text :icon="Check" :disabled="row.status === 'RESOLVED'" @click="openAction('ack', row)">
            {{ row.status === 'ACKED' ? '补充' : '确认' }}
          </el-button>
          <el-button text :icon="CircleCheck" :disabled="row.status === 'RESOLVED'" @click="openAction('resolve', row)">解除</el-button>
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

    <el-dialog v-model="actionDialog.visible" :title="actionDialog.title" width="min(460px, calc(100vw - 32px))">
      <el-input
        v-model="actionDialog.remark"
        type="textarea"
        :rows="5"
        maxlength="500"
        show-word-limit
        placeholder="填写处置说明"
      />
      <template #footer>
        <el-button @click="actionDialog.visible = false">取消</el-button>
        <el-button type="primary" :loading="submitting" @click="submitAction">提交</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="detailDrawer" title="报警详情" :size="drawerSize">
      <div v-if="selectedAlarm" class="alarm-detail">
        <el-descriptions :column="1" border>
          <el-descriptions-item label="设备">{{ selectedAlarm.device?.code }} {{ selectedAlarm.device?.name }}</el-descriptions-item>
          <el-descriptions-item label="区域">{{ selectedAlarm.device?.area?.name ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="基站">{{ selectedAlarm.device?.baseStation?.name ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="类型">{{ selectedAlarm.gasType }}</el-descriptions-item>
          <el-descriptions-item label="等级">{{ severityText(selectedAlarm.severity) }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ statusText(selectedAlarm.status) }}</el-descriptions-item>
          <el-descriptions-item label="当前值/阈值">{{ selectedAlarm.value }} / {{ selectedAlarm.thresholdValue }}</el-descriptions-item>
          <el-descriptions-item label="报警时间">{{ formatTime(selectedAlarm.startedAt) }}</el-descriptions-item>
          <el-descriptions-item label="确认备注">{{ selectedAlarm.ackRemark ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="解除备注">{{ selectedAlarm.resolveRemark ?? '-' }}</el-descriptions-item>
          <el-descriptions-item label="内容">{{ selectedAlarm.message }}</el-descriptions-item>
        </el-descriptions>

        <h3 class="detail-title">处置记录</h3>
        <el-timeline>
          <el-timeline-item v-for="action in selectedAlarm.actions ?? []" :key="action.id" :timestamp="formatTime(action.createdAt)">
            <strong>{{ actionText(action.action) }}</strong>
            <span class="muted"> {{ action.user?.name ?? action.user?.username ?? '系统' }}</span>
            <p v-if="action.remark">{{ action.remark }}</p>
          </el-timeline-item>
        </el-timeline>
      </div>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { Check, CircleCheck, Refresh, Search, View } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import { computed, onMounted, reactive, ref, watch } from 'vue';
import { ackAlarm, getAlarm, getAlarms, getAlarmStatistics, resolveAlarm } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const rows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const submitting = ref(false);
const statistics = ref<any>({});
const detailDrawer = ref(false);
const selectedAlarm = ref<any>(null);

const filters = reactive({
  status: '',
  severity: '',
  gasType: '',
  keyword: '',
  page: 1,
  pageSize: 20,
});

const actionDialog = reactive({
  visible: false,
  type: 'ack' as 'ack' | 'resolve',
  title: '',
  alarmId: '',
  remark: '',
});

const statusOptions = ['ACTIVE', 'ACKED', 'RESOLVED'];
const severityOptions = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const gasOptions = ['CH4', 'O2', 'CO', 'H2S', 'BATTERY'];

const metricCards = computed(() => [
  { label: '活动报警', value: statistics.value.byStatus?.ACTIVE ?? 0, color: '#dc2626' },
  { label: '已确认', value: statistics.value.byStatus?.ACKED ?? 0, color: '#ca8a04' },
  { label: '已解除', value: statistics.value.byStatus?.RESOLVED ?? 0, color: '#16a34a' },
  { label: '升级中', value: statistics.value.escalatedActive ?? 0, color: '#b91c1c' },
  {
    label: '严重/紧急',
    value: (statistics.value.bySeverity?.HIGH ?? 0) + (statistics.value.bySeverity?.CRITICAL ?? 0),
    color: '#ea580c',
  },
]);

function params() {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined));
}

async function load() {
  loading.value = true;
  try {
    const [alarmResult, statisticsResult]: any[] = await Promise.all([
      getAlarms(params()),
      getAlarmStatistics(),
    ]);
    rows.value = alarmResult.items ?? alarmResult;
    total.value = alarmResult.total ?? rows.value.length;
    statistics.value = statisticsResult;
  } finally {
    loading.value = false;
  }
}

function search() {
  filters.page = 1;
  void load();
}

function resetFilters() {
  filters.status = '';
  filters.severity = '';
  filters.gasType = '';
  filters.keyword = '';
  search();
}

function handleSizeChange() {
  filters.page = 1;
  void load();
}

async function openDetail(row: any) {
  selectedAlarm.value = await getAlarm(row.id);
  detailDrawer.value = true;
}

function openAction(type: 'ack' | 'resolve', row: any) {
  actionDialog.visible = true;
  actionDialog.type = type;
  actionDialog.title = type === 'ack' ? '确认报警' : '解除报警';
  actionDialog.alarmId = row.id;
  actionDialog.remark = type === 'ack' ? (row.ackRemark ?? '') : (row.resolveRemark ?? '');
}

async function submitAction() {
  submitting.value = true;
  try {
    const payload = { remark: actionDialog.remark };
    if (actionDialog.type === 'ack') {
      await ackAlarm(actionDialog.alarmId, payload);
    } else {
      await resolveAlarm(actionDialog.alarmId, payload);
    }
    actionDialog.visible = false;
    ElMessage.success('操作成功');
    await load();
  } finally {
    submitting.value = false;
  }
}

function severityType(severity: string) {
  return ({ LOW: 'info', MEDIUM: 'warning', HIGH: 'danger', CRITICAL: 'danger' } as Record<string, string>)[severity] ?? 'info';
}

function statusType(status: string) {
  return ({ ACTIVE: 'danger', ACKED: 'warning', RESOLVED: 'success' } as Record<string, string>)[status] ?? 'info';
}

function severityText(severity: string) {
  return ({ LOW: '低', MEDIUM: '中', HIGH: '高', CRITICAL: '紧急' } as Record<string, string>)[severity] ?? severity;
}

function statusText(status: string) {
  return ({ ACTIVE: '活动', ACKED: '已确认', RESOLVED: '已解除' } as Record<string, string>)[status] ?? status;
}

function actionText(action: string) {
  return ({ ACK: '确认', RESOLVE: '解除', ESCALATE: '升级' } as Record<string, string>)[action] ?? action;
}

function formatTime(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '-';
}

const drawerSize = computed(() => (window.innerWidth < 640 ? '100%' : '520px'));

watch(() => realtime.latestAlarm, () => load());
onMounted(load);
</script>

<style scoped>
.alarm-page {
  min-width: 0;
}

.alarm-metrics {
  grid-template-columns: repeat(5, minmax(128px, 1fr));
}

.alarm-metric {
  min-height: 106px;
}

.alarm-filter-panel {
  margin-bottom: 14px;
}

.alarm-filters {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.alarm-table {
  padding: 0;
}

.pagination-bar {
  display: flex;
  justify-content: flex-end;
  padding: 14px 0 0;
}

.muted {
  color: #94a3b8;
}

.alarm-detail {
  display: grid;
  gap: 18px;
}

.detail-title {
  margin: 0;
  font-size: 16px;
}

@media (max-width: 1100px) {
  .alarm-metrics {
    grid-template-columns: 1fr;
  }
}
</style>
