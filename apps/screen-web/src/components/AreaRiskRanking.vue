<template>
  <section class="screen-panel">
    <h2>区域风险排行</h2>
    <div v-for="item in data.slice(0, 6)" :key="item.areaId" class="rank-row">
      <span>
        {{ item.areaName }}
        <small v-if="item.escalatedAlarms">升级 {{ item.escalatedAlarms }}</small>
        <small v-if="item.calibrationFailedItems">标定异常 {{ item.calibrationFailedItems }}</small>
        <small v-if="item.calibrationOverdueItems">标定超期 {{ item.calibrationOverdueItems }}</small>
      </span>
      <strong>{{ item.riskScore }}</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ data: any[] }>();
</script>
