<template>
  <SimpleResourceView title="标定记录" endpoint="/calibrations" :columns="columns" />
</template>

<script setup lang="ts">
import SimpleResourceView from './SimpleResourceView.vue';
const columns = [
  { prop: 'device.code', label: '设备' },
  { prop: 'gasType', label: '气体' },
  { prop: 'standardValue', label: '标准值' },
  { prop: 'afterValue', label: '标定后' },
  { prop: 'calibratedBy', label: '标定人' },
  { prop: 'calibratedAt', label: '标定时间' },
];
</script>
