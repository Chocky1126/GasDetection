<template>
  <section class="screen-panel mine-map">
    <h2>井下地图</h2>
    <div class="map-canvas">
      <div v-for="area in areas" :key="area.name" class="area-block" :style="area.style">
        {{ area.name }}
      </div>
      <div
        v-for="(item, index) in snapshots"
        :key="item.deviceId ?? index"
        class="device-dot"
        :class="statusClass(item.status)"
        :style="{ left: `${8 + (index % 20) * 4.6}%`, top: `${18 + Math.floor(index / 20) * 14}%` }"
        :title="item.device?.code"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ snapshots: any[] }>();

const areas = [
  { name: '一采区', style: { left: '8%', top: '14%', width: '28%', height: '22%' } },
  { name: '二采区', style: { left: '48%', top: '12%', width: '32%', height: '24%' } },
  { name: '运输巷', style: { left: '14%', top: '48%', width: '68%', height: '12%' } },
  { name: '回风巷', style: { left: '10%', top: '70%', width: '35%', height: '15%' } },
  { name: '中央变电所', style: { left: '56%', top: '68%', width: '28%', height: '16%' } },
];

function statusClass(status: string) {
  return {
    online: status === 'ONLINE',
    offline: status === 'OFFLINE',
    fault: status === 'FAULT',
  };
}
</script>
