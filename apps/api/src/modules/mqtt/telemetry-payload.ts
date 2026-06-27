import { DeviceStatus, SensorStatus } from '@prisma/client';

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
