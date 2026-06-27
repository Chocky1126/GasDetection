<template>
  <section class="screen-panel">
    <h2>设备状态分布</h2>
    <div ref="chartEl" class="chart"></div>
  </section>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ data: any[] }>();
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function render() {
  if (!chartEl.value) return;
  chart ??= echarts.init(chartEl.value);
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: {},
    series: [{
      type: 'pie',
      radius: ['48%', '72%'],
      data: props.data.map((item) => ({ name: item.status, value: item.count })),
      label: { color: '#dbeafe' },
    }],
  });
}

onMounted(render);
watch(() => props.data, render, { deep: true });
onBeforeUnmount(() => chart?.dispose());
</script>
