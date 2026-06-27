<template>
  <section>
    <div class="toolbar">
      <h2 class="page-title">报警规则</h2>
      <el-button type="primary" @click="drawer = true">新增规则</el-button>
    </div>
    <el-table :data="rows" class="panel">
      <el-table-column prop="name" label="规则名称" />
      <el-table-column prop="gasType" label="类型" width="100" />
      <el-table-column prop="operator" label="条件" width="100" />
      <el-table-column prop="thresholdValue" label="阈值" width="100" />
      <el-table-column prop="severity" label="等级" width="110" />
      <el-table-column prop="enabled" label="启用" width="100" />
    </el-table>
    <el-drawer v-model="drawer" title="报警规则" size="420px">
      <el-form :model="form" label-position="top">
        <el-form-item label="名称"><el-input v-model="form.name" /></el-form-item>
        <el-form-item label="气体类型"><el-select v-model="form.gasType"><el-option v-for="item in gasTypes" :key="item" :value="item" :label="item" /></el-select></el-form-item>
        <el-form-item label="条件"><el-select v-model="form.operator"><el-option v-for="item in operators" :key="item" :value="item" :label="item" /></el-select></el-form-item>
        <el-form-item label="阈值"><el-input-number v-model="form.thresholdValue" :min="0" /></el-form-item>
        <el-form-item label="等级"><el-select v-model="form.severity"><el-option v-for="item in severities" :key="item" :value="item" :label="item" /></el-select></el-form-item>
      </el-form>
      <el-button type="primary" @click="save">保存</el-button>
    </el-drawer>
  </section>
</template>

<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue';
import { createResource, listResource } from '../api/modules';

const rows = ref<any[]>([]);
const drawer = ref(false);
const gasTypes = ['CH4', 'O2', 'CO', 'H2S', 'BATTERY'];
const operators = ['GT', 'GTE', 'LT', 'LTE', 'EQ'];
const severities = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];
const form = reactive({ name: '', gasType: 'CH4', operator: 'GTE', thresholdValue: 1, severity: 'HIGH', enabled: true });

async function load() {
  rows.value = (await listResource('/alarm-rules')) as any;
}

async function save() {
  await createResource('/alarm-rules', form);
  drawer.value = false;
  await load();
}

onMounted(load);
</script>
