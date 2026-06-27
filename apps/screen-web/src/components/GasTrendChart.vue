<template>
  <section class="screen-panel trend-panel">
    <h2>气体趋势</h2>
    <div ref="chartEl" class="trend-chart"></div>
  </section>
</template>

<script setup lang="ts">
import * as echarts from 'echarts';
import { onBeforeUnmount, onMounted, ref, watch } from 'vue';

const props = defineProps<{ records: any[] }>();
const chartEl = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function render() {
  if (!chartEl.value) return;
  chart ??= echarts.init(chartEl.value);
  const times = props.records.map((item) => new Date(item.reportedAt).toLocaleTimeString('zh-CN', { hour12: false }));
  chart.setOption({
    backgroundColor: 'transparent',
    tooltip: { trigger: 'axis' },
    legend: { textStyle: { color: '#dbeafe' } },
    grid: { left: 36, right: 20, top: 36, bottom: 28 },
    xAxis: { type: 'category', data: times, axisLabel: { color: '#9fb7d3' } },
    yAxis: { type: 'value', axisLabel: { color: '#9fb7d3' }, splitLine: { lineStyle: { color: '#1e3a56' } } },
    series: [
      { name: 'CH4', type: 'line', smooth: true, data: props.records.map((item) => item.ch4) },
      { name: 'O2', type: 'line', smooth: true, data: props.records.map((item) => item.o2) },
      { name: 'CO', type: 'line', smooth: true, data: props.records.map((item) => item.co) },
      { name: 'H2S', type: 'line', smooth: true, data: props.records.map((item) => item.h2s) },
    ],
  });
}

onMounted(render);
watch(() => props.records, render, { deep: true });
onBeforeUnmount(() => chart?.dispose());
</script>
