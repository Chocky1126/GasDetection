<template>
  <el-container class="admin-shell">
    <el-aside width="248px" class="sidebar">
      <div class="brand">井下四合一气体检测仪</div>
      <el-menu router :default-active="$route.path" background-color="#0f2740" text-color="#d8e7f7" active-text-color="#ffffff">
        <el-menu-item index="/dashboard"><el-icon><House /></el-icon>登录后首页</el-menu-item>
        <el-menu-item index="/devices"><el-icon><Cpu /></el-icon>设备管理</el-menu-item>
        <el-menu-item index="/monitor"><el-icon><Monitor /></el-icon>实时监测</el-menu-item>
        <el-menu-item index="/alarm-rules"><el-icon><Lock /></el-icon>报警规则</el-menu-item>
        <el-menu-item index="/alarms"><el-icon><Bell /></el-icon>报警中心</el-menu-item>
        <el-menu-item index="/personnel"><el-icon><User /></el-icon>人员管理</el-menu-item>
        <el-menu-item index="/teams"><el-icon><UserFilled /></el-icon>班组管理</el-menu-item>
        <el-menu-item index="/areas"><el-icon><Location /></el-icon>区域管理</el-menu-item>
        <el-menu-item index="/base-stations"><el-icon><Connection /></el-icon>基站管理</el-menu-item>
        <el-menu-item index="/calibrations"><el-icon><Tools /></el-icon>标定记录</el-menu-item>
        <el-menu-item index="/audit-logs"><el-icon><Document /></el-icon>操作日志</el-menu-item>
        <el-sub-menu index="/system">
          <template #title><el-icon><Setting /></el-icon>系统管理</template>
          <el-menu-item index="/system/users">用户管理</el-menu-item>
          <el-menu-item index="/system/roles">角色管理</el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>
    <el-container>
      <el-header class="topbar">
        <div class="top-title">井下四合一气体检测仪管理后台</div>
        <div class="top-actions">
          <el-tag :type="realtime.connected ? 'success' : 'info'">WebSocket {{ realtime.connected ? '在线' : '未连接' }}</el-tag>
          <el-button @click="logout">退出</el-button>
        </div>
      </el-header>
      <el-main class="main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Bell, Connection, Cpu, Document, House, Location, Lock, Monitor, Setting, Tools, User, UserFilled } from '@element-plus/icons-vue';
import { useAuthStore } from '../stores/auth';
import { useRealtimeStore } from '../stores/realtime';

const auth = useAuthStore();
const realtime = useRealtimeStore();
const router = useRouter();

onMounted(() => realtime.connect());

function logout() {
  auth.logout();
  router.push('/login');
}
</script>
