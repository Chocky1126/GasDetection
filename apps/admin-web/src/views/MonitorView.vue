<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">实时监测</h2>
      <el-button @click="load">刷新</el-button>
    </div>
    <el-table :data="rows" class="panel" height="680">
      <el-table-column prop="device.code" label="设备" width="120" />
      <el-table-column prop="device.area.name" label="区域" width="120" />
      <el-table-column prop="ch4" label="CH4" width="90" />
      <el-table-column prop="o2" label="O2" width="90" />
      <el-table-column prop="co" label="CO" width="90" />
      <el-table-column prop="h2s" label="H2S" width="90" />
      <el-table-column prop="batteryLevel" label="电量" width="90" />
      <el-table-column prop="status" label="状态" width="110" />
      <el-table-column prop="sensorStatus" label="传感器" width="110" />
      <el-table-column prop="lastSeenAt" label="最近上报" min-width="180" />
    </el-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { getSnapshots } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const rows = ref<any[]>([]);

async function load() {
  const result: any = await getSnapshots({ pageSize: 200 });
  rows.value = result.items ?? result;
}

watch(() => realtime.latestSnapshot, () => load());
onMounted(load);
</script>
