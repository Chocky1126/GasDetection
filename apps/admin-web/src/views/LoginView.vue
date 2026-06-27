<template>
  <main class="login-page">
    <section class="login-panel">
      <h1>井下四合一气体检测仪管理后台</h1>
      <el-form :model="form" label-position="top" @submit.prevent="submit">
        <el-form-item label="用户名">
          <el-input v-model="form.username" size="large" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" size="large" show-password />
        </el-form-item>
        <el-button type="primary" size="large" :loading="loading" class="login-button" @click="submit">登录</el-button>
      </el-form>
    </section>
  </main>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useAuthStore } from '../stores/auth';

const auth = useAuthStore();
const router = useRouter();
const loading = ref(false);
const form = reactive({ username: 'admin', password: 'admin123456' });

async function submit() {
  loading.value = true;
  try {
    await auth.login(form.username, form.password);
    router.push('/dashboard');
  } catch {
    ElMessage.error('登录失败');
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #0d2740, #163f64 55%, #eef5fb 55%);
}

.login-panel {
  width: min(420px, calc(100vw - 32px));
  background: #fff;
  border-radius: 8px;
  padding: 32px;
  box-shadow: 0 20px 50px rgba(7, 29, 50, 0.18);
}

h1 {
  margin: 0 0 24px;
  font-size: 22px;
}

.login-button {
  width: 100%;
}
</style>
