import { SimulatorService } from './simulator.service.js';

const simulator = new SimulatorService({
  mqttUrl: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
  deviceCount: Number(process.env.SIMULATOR_DEVICE_COUNT ?? 100),
  intervalMs: Number(process.env.SIMULATOR_INTERVAL_MS ?? 3000),
});

process.on('SIGINT', () => {
  simulator.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  simulator.stop();
  process.exit(0);
});

simulator.start();
