<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">{{ title }}</h2>
      <el-button @click="load">刷新</el-button>
    </div>
    <el-table :data="rows" class="panel" height="660">
      <el-table-column v-for="column in columns" :key="column.prop" :prop="column.prop" :label="column.label" />
    </el-table>
  </section>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { listResource } from '../api/modules';

const props = defineProps<{
  title: string;
  endpoint: string;
  columns: Array<{ prop: string; label: string }>;
}>();

const rows = ref<any[]>([]);

async function load() {
  const result: any = await listResource(props.endpoint, { pageSize: 100 });
  rows.value = result.items ?? result;
}

onMounted(load);
</script>
