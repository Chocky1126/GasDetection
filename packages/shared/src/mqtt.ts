export const MQTT_TOPICS = {
  telemetry: 'gas/devices/+/telemetry',
  status: 'gas/devices/+/status',
  fault: 'gas/devices/+/fault',
  alarm: 'gas/devices/+/alarm',
} as const;

export function deviceTelemetryTopic(deviceCode: string): string {
  return `gas/devices/${deviceCode}/telemetry`;
}
