import mqtt, { MqttClient } from 'mqtt';
import { createDevices, type SimulatedDevice } from './device-factory.js';
import { deviceStatusTopic, deviceTelemetryTopic, generateTelemetry } from './telemetry.js';

export interface SimulatorOptions {
  mqttUrl: string;
  deviceCount: number;
  intervalMs: number;
}

export class SimulatorService {
  private readonly devices: SimulatedDevice[];
  private client?: MqttClient;
  private timer?: NodeJS.Timeout;

  constructor(private readonly options: SimulatorOptions) {
    this.devices = createDevices(options.deviceCount);
  }

  start() {
    this.client = mqtt.connect(this.options.mqttUrl);
    this.client.on('connect', () => {
      console.log(`[simulator] connected ${this.options.mqttUrl}, devices=${this.devices.length}`);
      this.timer = setInterval(() => this.publishCycle(), this.options.intervalMs);
      this.publishCycle();
    });
    this.client.on('error', (error) => {
      console.error(`[simulator] mqtt error: ${error.message}`);
    });
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.client?.end(true);
  }

  private publishCycle() {
    if (!this.client?.connected) {
      return;
    }

    let telemetryCount = 0;
    let offlineCount = 0;
    let faultCount = 0;

    for (const device of this.devices) {
      if (Math.random() < 0.02) {
        offlineCount += 1;
        this.client.publish(
          deviceStatusTopic(device.code),
          JSON.stringify({ deviceCode: device.code, onlineStatus: 'OFFLINE', reportedAt: new Date().toISOString() }),
        );
        continue;
      }

      const payload = generateTelemetry(device);
      if (payload.sensorStatus === 'FAULT') {
        faultCount += 1;
      }
      telemetryCount += 1;
      this.client.publish(deviceTelemetryTopic(device.code), JSON.stringify(payload));
    }

    console.log(`[simulator] cycle telemetry=${telemetryCount} offline=${offlineCount} fault=${faultCount}`);
  }
}
