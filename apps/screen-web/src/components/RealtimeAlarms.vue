<template>
  <section class="screen-panel alarm-feed">
    <h2>实时报警</h2>
    <div v-for="alarm in alarms" :key="alarm.id" class="alarm-row">
      <strong>{{ alarm.device?.code ?? alarm.deviceId }}</strong>
      <span>{{ alarm.message }}</span>
      <em>{{ alarm.severity }}</em>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ alarms: any[] }>();
</script>
