import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router';
import { useAuthStore } from '../stores/auth';
import AdminLayout from '../layout/AdminLayout.vue';
import LoginView from '../views/LoginView.vue';
import DashboardView from '../views/DashboardView.vue';
import DevicesView from '../views/DevicesView.vue';
import MonitorView from '../views/MonitorView.vue';
import AlarmRulesView from '../views/AlarmRulesView.vue';
import AlarmsView from '../views/AlarmsView.vue';
import PersonnelView from '../views/PersonnelView.vue';
import TeamsView from '../views/TeamsView.vue';
import AreasView from '../views/AreasView.vue';
import BaseStationsView from '../views/BaseStationsView.vue';
import CalibrationsView from '../views/CalibrationsView.vue';
import AuditLogsView from '../views/AuditLogsView.vue';
import SystemUsersView from '../views/SystemUsersView.vue';
import SystemRolesView from '../views/SystemRolesView.vue';

const routes: RouteRecordRaw[] = [
  { path: '/login', component: LoginView },
  {
    path: '/',
    component: AdminLayout,
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: DashboardView },
      { path: 'devices', component: DevicesView },
      { path: 'monitor', component: MonitorView },
      { path: 'alarm-rules', component: AlarmRulesView },
      { path: 'alarms', component: AlarmsView },
      { path: 'personnel', component: PersonnelView },
      { path: 'teams', component: TeamsView },
      { path: 'areas', component: AreasView },
      { path: 'base-stations', component: BaseStationsView },
      { path: 'calibrations', component: CalibrationsView },
      { path: 'audit-logs', component: AuditLogsView },
      { path: 'system/users', component: SystemUsersView },
      { path: 'system/roles', component: SystemRolesView },
    ],
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to) => {
  const auth = useAuthStore();
  if (to.path !== '/login' && !auth.isAuthenticated) {
    return '/login';
  }
  if (to.path === '/login' && auth.isAuthenticated) {
    return '/dashboard';
  }
  return true;
});
