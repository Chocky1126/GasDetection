import { describe, expect, it } from 'vitest';
import { createDevices } from './device-factory';
import { generateTelemetry } from './telemetry';

describe('simulator telemetry', () => {
  it('creates deterministic device codes', () => {
    const devices = createDevices(100);

    expect(devices).toHaveLength(100);
    expect(devices[0].code).toBe('GAS-0001');
    expect(devices[99].code).toBe('GAS-0100');
  });

  it('generates telemetry inside physical bounds', () => {
    const [device] = createDevices(1);
    const telemetry = generateTelemetry(device, { abnormalRate: 0 });

    expect(telemetry.batteryLevel).toBeGreaterThanOrEqual(0);
    expect(telemetry.batteryLevel).toBeLessThanOrEqual(100);
    expect(telemetry.ch4).toBeGreaterThanOrEqual(0);
    expect(telemetry.o2).toBeGreaterThanOrEqual(0);
    expect(telemetry.co).toBeGreaterThanOrEqual(0);
    expect(telemetry.h2s).toBeGreaterThanOrEqual(0);
    expect(telemetry.deviceCode).toBe('GAS-0001');
  });
});
