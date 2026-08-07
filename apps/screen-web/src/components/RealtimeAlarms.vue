<template>
  <section class="screen-panel alarm-feed">
    <h2>实时报警</h2>
    <div v-for="alarm in alarms" :key="alarm.id" class="alarm-row" :class="{ escalated: alarm.escalationLevel > 0 }">
      <strong>{{ alarm.device?.code ?? alarm.deviceId }}</strong>
      <span>{{ alarm.message }}</span>
      <em>{{ alarm.escalationLevel > 0 ? '升级 ' : '' }}{{ alarm.severity }}</em>
    </div>
  </section>
</template>

<script setup lang="ts">
defineProps<{ alarms: any[] }>();
</script>
