import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';
import { http, screenLogin } from '../api/http';

export const useScreenStore = defineStore('screen', () => {
  const overview = ref<any>({});
  const snapshots = ref<any[]>([]);
  const alarms = ref<any[]>([]);
  const trends = ref<any[]>([]);
  const statusDistribution = ref<any[]>([]);
  const areaRiskRanking = ref<any[]>([]);
  const connected = ref(false);
  let socket: Socket | null = null;

  function applyScreenMetrics(payload: any) {
    if (payload?.overview) {
      overview.value = payload.overview;
    }
    if (Array.isArray(payload?.trends)) {
      trends.value = payload.trends;
    }
    if (Array.isArray(payload?.statusDistribution)) {
      statusDistribution.value = payload.statusDistribution;
    }
    if (Array.isArray(payload?.areaRiskRanking)) {
      areaRiskRanking.value = payload.areaRiskRanking;
    }
  }

  async function bootstrap() {
    await screenLogin();
    await refresh();
    connect();
  }

  async function refresh() {
    const [overviewData, snapshotData, trendData, statusData, areaData, alarmData] = await Promise.all([
      http.get('/monitor/overview') as any,
      http.get('/monitor/snapshots', { params: { pageSize: 200 } }) as any,
      http.get('/monitor/trends') as any,
      http.get('/monitor/status-distribution') as any,
      http.get('/monitor/area-risk-ranking') as any,
      http.get('/alarms', { params: { status: 'ACTIVE', pageSize: 30 } }) as any,
    ]);
    overview.value = overviewData;
    snapshots.value = snapshotData.items ?? snapshotData;
    trends.value = trendData;
    statusDistribution.value = statusData;
    areaRiskRanking.value = areaData;
    alarms.value = alarmData.items ?? alarmData;
  }

  function connect() {
    if (socket) return;
    socket = io('/realtime', { transports: ['websocket'] });
    socket.on('connect', () => {
      connected.value = true;
      socket?.emit('subscribe.screen');
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on('device.snapshot.updated', (payload) => {
      const next = snapshots.value.filter((item) => item.device?.code !== payload.deviceCode);
      snapshots.value = [payload.snapshot, ...next].slice(0, 200);
    });
    socket.on('alarm.created', (payload) => {
      alarms.value = [payload, ...alarms.value].slice(0, 30);
    });
    socket.on('alarm.updated', () => {
      void refresh();
    });
    socket.on('screen.overview.updated', (payload) => {
      overview.value = payload;
    });
    socket.on('screen.metrics.updated', (payload) => {
      applyScreenMetrics(payload);
    });
  }

  return { overview, snapshots, alarms, trends, statusDistribution, areaRiskRanking, connected, bootstrap, refresh };
});
