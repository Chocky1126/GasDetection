<template>
  <section class="screen-panel">
    <h2>区域风险排行</h2>
    <div v-for="item in data.slice(0, 6)" :key="item.areaId" class="rank-row">
      <span>
        {{ item.areaName }}
        <small v-if="item.escalatedAlarms">升级 {{ item.escalatedAlarms }}</small>
      </span>
      <strong>{{ item.riskScore }}</strong>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ data: any[] }>();
</script>
