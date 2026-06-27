<template>
  <main class="screen">
    <header class="screen-header">
      <div>
        <h1>井下四合一气体检测仪数据大屏</h1>
        <p>{{ timeText }} · WebSocket {{ store.connected ? '在线' : '连接中' }}</p>
      </div>
      <OverviewMetrics :overview="store.overview" />
    </header>

    <section class="screen-grid">
      <RealtimeAlarms :alarms="store.alarms" />
      <MineMap :snapshots="store.snapshots" />
      <aside class="right-column">
        <StatusDistribution :data="store.statusDistribution" />
        <AreaRiskRanking :data="store.areaRiskRanking" />
      </aside>
    </section>

    <GasTrendChart :records="store.trends" />
  </main>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import OverviewMetrics from '../components/OverviewMetrics.vue';
import RealtimeAlarms from '../components/RealtimeAlarms.vue';
import MineMap from '../components/MineMap.vue';
import StatusDistribution from '../components/StatusDistribution.vue';
import AreaRiskRanking from '../components/AreaRiskRanking.vue';
import GasTrendChart from '../components/GasTrendChart.vue';
import { useScreenStore } from '../stores/screen';

const store = useScreenStore();
const now = ref(new Date());
const timeText = computed(() => now.value.toLocaleString('zh-CN', { hour12: false }));

onMounted(() => {
  void store.bootstrap();
  setInterval(() => {
    now.value = new Date();
  }, 1000);
});
</script>
