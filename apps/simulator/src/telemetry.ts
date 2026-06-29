import type { SimulatedDevice } from './device-factory.js';

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'FAULT';
export type SensorStatus = 'NORMAL' | 'FAULT';

export interface TelemetryOptions {
  abnormalRate?: number;
}

export interface TelemetryPayload {
  deviceCode: string;
  ch4: number;
  o2: number;
  co: number;
  h2s: number;
  batteryLevel: number;
  lng: number;
  lat: number;
  depth: number;
  onlineStatus: DeviceStatus;
  sensorStatus: SensorStatus;
  reportedAt: string;
}

export function generateTelemetry(device: SimulatedDevice, options: TelemetryOptions = {}): TelemetryPayload {
  const abnormalRate = options.abnormalRate ?? 0.08;
  const abnormal = Math.random() < abnormalRate;
  const fault = Math.random() < 0.015;
  const lowBattery = abnormal && Math.random() < 0.25;
  const gasCase = Math.floor(Math.random() * 4);
  const batteryDrain = Math.random() < 0.4 ? 1 : 0;
  device.batteryLevel = clamp(device.batteryLevel - batteryDrain, 0, 100);

  const telemetry: TelemetryPayload = {
    deviceCode: device.code,
    ch4: randomRange(0.05, 0.8),
    o2: randomRange(20.0, 21.0),
    co: randomRange(0, 18),
    h2s: randomRange(0, 6),
    batteryLevel: lowBattery ? Math.floor(randomRange(5, 15)) : device.batteryLevel,
    lng: jitter(device.lng, 0.00008),
    lat: jitter(device.lat, 0.00008),
    depth: jitter(device.depth, 2),
    onlineStatus: 'ONLINE',
    sensorStatus: fault ? 'FAULT' : 'NORMAL',
    reportedAt: new Date().toISOString(),
  };

  if (abnormal) {
    if (gasCase === 0) telemetry.ch4 = randomRange(1.0, 2.5);
    if (gasCase === 1) telemetry.o2 = randomRange(16.0, 19.4);
    if (gasCase === 2) telemetry.co = randomRange(24, 80);
    if (gasCase === 3) telemetry.h2s = randomRange(10, 40);
  }

  return roundTelemetry(telemetry);
}

export function deviceTelemetryTopic(deviceCode: string): string {
  return `gas/devices/${deviceCode}/telemetry`;
}

export function deviceStatusTopic(deviceCode: string): string {
  return `gas/devices/${deviceCode}/status`;
}

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function jitter(value: number, amount: number): number {
  return value + (Math.random() - 0.5) * amount;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function roundTelemetry(telemetry: TelemetryPayload): TelemetryPayload {
  return {
    ...telemetry,
    ch4: round(telemetry.ch4, 3),
    o2: round(telemetry.o2, 2),
    co: round(telemetry.co, 2),
    h2s: round(telemetry.h2s, 2),
    lng: round(telemetry.lng, 6),
    lat: round(telemetry.lat, 6),
    depth: round(telemetry.depth, 2),
    batteryLevel: Math.round(telemetry.batteryLevel),
  };
}
