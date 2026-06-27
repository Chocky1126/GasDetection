<template>
  <section>
    <h2 class="page-title">登录后首页</h2>
    <div class="metric-grid">
      <div v-for="item in metrics" :key="item.label" class="metric-card">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value" :style="{ color: item.color }">{{ item.value }}</div>
      </div>
    </div>
    <div class="content-grid">
      <div class="panel">
        <div class="toolbar">
          <h3>实时报警</h3>
          <el-button text @click="load">刷新</el-button>
        </div>
        <el-table :data="alarms" height="360">
          <el-table-column prop="device.code" label="设备" width="120" />
          <el-table-column prop="message" label="报警内容" />
          <el-table-column prop="severity" label="等级" width="100" />
          <el-table-column prop="startedAt" label="时间" width="190" />
        </el-table>
      </div>
      <div class="panel">
        <h3>气体趋势</h3>
        <div class="trend-grid">
          <div class="mini-chart">CH4<br /><strong>实时曲线</strong></div>
          <div class="mini-chart">O2<br /><strong>实时曲线</strong></div>
          <div class="mini-chart">CO<br /><strong>实时曲线</strong></div>
          <div class="mini-chart">H2S<br /><strong>实时曲线</strong></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { getAlarms, getOverview } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const overview = ref<any>({});
const alarms = ref<any[]>([]);

const metrics = computed(() => [
  { label: '设备总数', value: overview.value.totalDevices ?? 0, color: '#1d4ed8' },
  { label: '在线设备', value: overview.value.onlineDevices ?? 0, color: '#16a34a' },
  { label: '活跃报警', value: overview.value.activeAlarms ?? 0, color: '#dc2626' },
  { label: '故障设备', value: overview.value.faultDevices ?? 0, color: '#ea580c' },
  { label: '低电量', value: overview.value.lowBatteryDevices ?? 0, color: '#ca8a04' },
]);

async function load() {
  overview.value = await getOverview();
  const result: any = await getAlarms({ status: 'ACTIVE', pageSize: 20 });
  alarms.value = result.items ?? result;
}

watch(() => realtime.overview, (value) => {
  if (value) overview.value = value;
});

watch(() => realtime.latestAlarm, () => load());

onMounted(load);
</script>
