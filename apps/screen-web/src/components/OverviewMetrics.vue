<template>
  <div class="overview">
    <div v-for="item in items" :key="item.label" class="overview-item">
      <span>{{ item.label }}</span>
      <strong :style="{ color: item.color }">{{ item.value }}</strong>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ overview: any }>();
const items = computed(() => [
  { label: '设备总数', value: props.overview.totalDevices ?? 0, color: '#7dd3fc' },
  { label: '在线', value: props.overview.onlineDevices ?? 0, color: '#4ade80' },
  { label: '报警', value: props.overview.activeAlarms ?? 0, color: '#fb7185' },
  { label: '故障', value: props.overview.faultDevices ?? 0, color: '#fb923c' },
  { label: '低电量', value: props.overview.lowBatteryDevices ?? 0, color: '#facc15' },
]);
</script>
