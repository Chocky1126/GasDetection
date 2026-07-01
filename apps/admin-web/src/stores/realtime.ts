import { defineStore } from 'pinia';
import { io, Socket } from 'socket.io-client';
import { ref } from 'vue';

export const useRealtimeStore = defineStore('realtime', () => {
  const connected = ref(false);
  const latestSnapshot = ref<any>(null);
  const latestAlarm = ref<any>(null);
  const overview = ref<any>(null);
  let socket: Socket | null = null;

  function connect() {
    if (socket) return;
    socket = io('/realtime', { transports: ['websocket'] });
    socket.on('connect', () => {
      connected.value = true;
      socket?.emit('subscribe.monitor');
    });
    socket.on('disconnect', () => {
      connected.value = false;
    });
    socket.on('device.snapshot.updated', (payload) => {
      latestSnapshot.value = payload;
    });
    socket.on('alarm.created', (payload) => {
      latestAlarm.value = payload;
    });
    socket.on('alarm.updated', (payload) => {
      latestAlarm.value = payload;
    });
    socket.on('screen.overview.updated', (payload) => {
      overview.value = payload;
    });
  }

  return { connected, latestSnapshot, latestAlarm, overview, connect };
});
