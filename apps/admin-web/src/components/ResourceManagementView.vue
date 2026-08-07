<template>
  <section class="resource-page">
    <div class="toolbar resource-toolbar">
      <h2 class="page-title">{{ title }}</h2>
      <div class="toolbar-actions">
        <el-input
          v-model="keyword"
          clearable
          :placeholder="searchPlaceholder"
          style="width: 240px"
          @keyup.enter="search"
          @clear="search"
        />
        <el-button type="primary" :icon="Search" @click="search">查询</el-button>
        <el-button :icon="Plus" @click="openCreate">新增</el-button>
        <el-button :icon="Refresh" @click="load">刷新</el-button>
      </div>
    </div>

    <el-table v-loading="loading" :data="rows" class="panel resource-table" height="620">
      <el-table-column
        v-for="column in columns"
        :key="column.prop"
        :label="column.label"
        :prop="column.prop"
        :width="column.width"
        :min-width="column.minWidth"
        show-overflow-tooltip
      >
        <template #default="{ row }">
          <el-tag v-if="column.tag" :type="column.tag(row).type" effect="plain">
            {{ column.tag(row).text }}
          </el-tag>
          <span v-else>{{ cellText(column, row) }}</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="150" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" :icon="Edit" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" :icon="Delete" @click="removeRow(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div class="pagination-bar">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[20, 50, 100]"
        :total="total"
        @size-change="handleSizeChange"
        @current-change="load"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="680px" destroy-on-close>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <div class="resource-form-grid">
          <el-form-item
            v-for="field in fields"
            :key="field.prop"
            :label="field.label"
            :prop="field.prop"
            :class="{ 'full-width': field.fullWidth }"
          >
            <el-input
              v-if="!field.type || field.type === 'text' || field.type === 'password'"
              v-model="form[field.prop]"
              :type="field.type === 'password' ? 'password' : 'text'"
              :placeholder="field.placeholder"
              :disabled="mode === 'edit' && field.disabledOnEdit"
              :show-password="field.type === 'password'"
            />
            <el-input
              v-else-if="field.type === 'textarea'"
              v-model="form[field.prop]"
              type="textarea"
              :rows="3"
              :placeholder="field.placeholder"
            />
            <el-input-number
              v-else-if="field.type === 'number'"
              v-model="form[field.prop]"
              :min="field.min"
              :max="field.max"
              :step="field.step ?? 1"
              :precision="field.precision"
              controls-position="right"
              class="number-input"
            />
            <el-select
              v-else-if="field.type === 'select' || field.type === 'multi-select'"
              v-model="form[field.prop]"
              :multiple="field.type === 'multi-select'"
              clearable
              filterable
              collapse-tags
              collapse-tags-tooltip
              :placeholder="field.placeholder ?? `请选择${field.label}`"
              class="field-select"
            >
              <el-option
                v-for="option in field.options ?? []"
                :key="option.value"
                :label="option.label"
                :value="option.value"
              />
            </el-select>
            <el-switch
              v-else-if="field.type === 'switch'"
              v-model="form[field.prop]"
              :active-text="field.activeText"
              :inactive-text="field.inactiveText"
            />
          </el-form-item>
        </div>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="submit">保存</el-button>
      </template>
    </el-dialog>
  </section>
</template>

<script setup lang="ts">
import { Delete, Edit, Plus, Refresh, Search } from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox, type FormInstance, type FormRules } from 'element-plus';
import { computed, onMounted, reactive, ref } from 'vue';
import { createResource, deleteResource, listResource, updateResource } from '../api/modules';
import type { ResourceColumn, ResourceField, ResourceMode } from './resource-management.types';

const props = withDefaults(
  defineProps<{
    title: string;
    endpoint: string;
    searchPlaceholder?: string;
    columns: ResourceColumn[];
    fields: ResourceField[];
    initialValues?: Record<string, unknown>;
    toForm?: (row: any) => Record<string, unknown>;
    toPayload?: (form: Record<string, any>, mode: ResourceMode) => Record<string, unknown>;
  }>(),
  {
    initialValues: () => ({}),
    searchPlaceholder: '输入编号或名称',
    toForm: undefined,
    toPayload: undefined,
  },
);

const rows = ref<any[]>([]);
const total = ref(0);
const loading = ref(false);
const saving = ref(false);
const keyword = ref('');
const page = ref(1);
const pageSize = ref(20);
const dialogVisible = ref(false);
const mode = ref<ResourceMode>('create');
const editingId = ref('');
const form = reactive<Record<string, any>>({});
const formRef = ref<FormInstance>();

const dialogTitle = computed(() => `${mode.value === 'create' ? '新增' : '编辑'}${props.title.replace('管理', '')}`);
const rules = computed<FormRules>(() => {
  const result: FormRules = {};
  for (const field of props.fields) {
    const required =
      field.required || (mode.value === 'create' && field.requiredOnCreate) || (mode.value === 'edit' && field.requiredOnEdit);
    if (required) {
      result[field.prop] = [
        {
          required: true,
          message: `${field.type === 'select' || field.type === 'multi-select' ? '请选择' : '请输入'}${field.label}`,
          trigger: field.type === 'select' || field.type === 'multi-select' || field.type === 'switch' ? 'change' : 'blur',
        },
      ];
    }
  }
  return result;
});

function cloneValue(value: unknown) {
  return Array.isArray(value) ? [...value] : value;
}

function blankForm() {
  const values: Record<string, any> = {};
  for (const field of props.fields) {
    if (Object.prototype.hasOwnProperty.call(props.initialValues, field.prop)) {
      values[field.prop] = cloneValue(props.initialValues[field.prop]);
    } else if (field.type === 'multi-select') {
      values[field.prop] = [];
    } else if (field.type === 'switch') {
      values[field.prop] = true;
    } else {
      values[field.prop] = undefined;
    }
  }
  return values;
}

function assignForm(values: Record<string, unknown>) {
  for (const key of Object.keys(form)) delete form[key];
  Object.assign(form, values);
}

function valueAtPath(row: any, path: string) {
  return path.split('.').reduce((value, key) => value?.[key], row);
}

function cellText(column: ResourceColumn, row: any) {
  const value = column.formatter ? column.formatter(row) : valueAtPath(row, column.prop);
  return value === undefined || value === null || value === '' ? '-' : String(value);
}

function errorMessage(error: any) {
  const message = error?.response?.data?.message;
  return Array.isArray(message) ? message.join('；') : message || '操作失败，请稍后重试';
}

async function load() {
  loading.value = true;
  try {
    const result: any = await listResource(props.endpoint, {
      keyword: keyword.value || undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    rows.value = result.items ?? result;
    total.value = result.total ?? rows.value.length;
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    loading.value = false;
  }
}

function search() {
  page.value = 1;
  void load();
}

function handleSizeChange() {
  page.value = 1;
  void load();
}

function openCreate() {
  mode.value = 'create';
  editingId.value = '';
  assignForm(blankForm());
  dialogVisible.value = true;
}

function openEdit(row: any) {
  mode.value = 'edit';
  editingId.value = row.id;
  const values = props.toForm ? props.toForm(row) : {};
  for (const field of props.fields) {
    if (!Object.prototype.hasOwnProperty.call(values, field.prop)) {
      values[field.prop] = field.valueFromRow ? field.valueFromRow(row) : valueAtPath(row, field.prop);
    }
  }
  assignForm({ ...blankForm(), ...values });
  dialogVisible.value = true;
}

async function submit() {
  if (!formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  saving.value = true;
  try {
    const values = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, cloneValue(value)]));
    const payload = props.toPayload ? props.toPayload(values, mode.value) : values;
    if (mode.value === 'create') {
      await createResource(props.endpoint, payload);
      ElMessage.success('新增成功');
    } else {
      await updateResource(props.endpoint, editingId.value, payload);
      ElMessage.success('更新成功');
    }
    dialogVisible.value = false;
    await load();
  } catch (error) {
    ElMessage.error(errorMessage(error));
  } finally {
    saving.value = false;
  }
}

async function removeRow(row: any) {
  try {
    await ElMessageBox.confirm(`确认删除“${row.name ?? row.code ?? row.username}”吗？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    });
    await deleteResource(props.endpoint, row.id);
    ElMessage.success('删除成功');
    if (rows.value.length === 1 && page.value > 1) page.value -= 1;
    await load();
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') ElMessage.error(errorMessage(error));
  }
}

onMounted(load);
</script>

<style scoped>
.resource-page {
  min-width: 0;
}

.resource-toolbar,
.toolbar-actions,
.pagination-bar {
  display: flex;
  align-items: center;
}

.resource-toolbar {
  gap: 16px;
}

.toolbar-actions {
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.resource-table {
  padding: 0;
}

.pagination-bar {
  justify-content: flex-end;
  padding-top: 14px;
}

.resource-form-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 0 18px;
}

.full-width {
  grid-column: 1 / -1;
}

.field-select,
.number-input {
  width: 100%;
}

@media (max-width: 760px) {
  .resource-toolbar,
  .toolbar-actions,
  .pagination-bar {
    align-items: stretch;
    flex-direction: column;
  }

  .toolbar-actions :deep(.el-input),
  .toolbar-actions :deep(.el-button) {
    width: 100% !important;
    margin-left: 0;
  }

  .resource-form-grid {
    grid-template-columns: 1fr;
  }

  .full-width {
    grid-column: auto;
  }
}
</style>
