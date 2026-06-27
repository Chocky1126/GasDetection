<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">报警中心</h2>
      <el-button @click="load">刷新</el-button>
    </div>
    <el-table :data="rows" class="panel" height="680">
      <el-table-column prop="device.code" label="设备" width="120" />
      <el-table-column prop="gasType" label="类型" width="90" />
      <el-table-column prop="severity" label="等级" width="100" />
      <el-table-column prop="status" label="状态" width="100" />
      <el-table-column prop="value" label="当前值" width="100" />
      <el-table-column prop="thresholdValue" label="阈值" width="100" />
      <el-table-column prop="message" label="内容" />
      <el-table-column label="操作" width="160">
        <template #default="{ row }">
          <el-button text @click="ack(row.id)">确认</el-button>
          <el-button text @click="resolve(row.id)">解除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import { ackAlarm, getAlarms, resolveAlarm } from '../api/modules';
import { useRealtimeStore } from '../stores/realtime';

const realtime = useRealtimeStore();
const rows = ref<any[]>([]);

async function load() {
  const result: any = await getAlarms({ pageSize: 100 });
  rows.value = result.items ?? result;
}

async function ack(id: string) {
  await ackAlarm(id);
  await load();
}

async function resolve(id: string) {
  await resolveAlarm(id);
  await load();
}

watch(() => realtime.latestAlarm, () => load());
onMounted(load);
</script>
