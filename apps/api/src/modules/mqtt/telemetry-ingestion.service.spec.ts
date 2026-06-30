import { DeviceStatus, SensorStatus } from '@prisma/client';
import { AlarmEvaluatorService } from '../alarms/alarm-evaluator.service';
import { MonitorService } from '../monitor/monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../redis/redis.service';
import { TelemetryIngestionService } from './telemetry-ingestion.service';

describe('TelemetryIngestionService', () => {
  it('emits a complete screen metrics payload after telemetry changes live state', async () => {
    const reportedAt = '2026-06-30T10:00:00.000Z';
    const device = {
      id: 'device-1',
      code: 'GD-001',
      status: DeviceStatus.OFFLINE,
      snapshot: null,
    };
    const telemetry = { id: 'telemetry-1', deviceId: device.id };
    const snapshot = { id: 'snapshot-1', deviceId: device.id, status: DeviceStatus.ONLINE };
    const metrics = {
      overview: { totalDevices: 100, onlineDevices: 80 },
      trends: [{ id: 'telemetry-1' }],
      statusDistribution: [{ status: DeviceStatus.ONLINE, count: 80 }],
      areaRiskRanking: [{ areaId: 'area-1', riskScore: 12 }],
    };
    const prisma = {
      device: {
        findUnique: jest.fn().mockResolvedValue(device),
        update: jest.fn().mockResolvedValue({ ...device, status: DeviceStatus.ONLINE }),
      },
      telemetryRecord: {
        create: jest.fn().mockResolvedValue(telemetry),
      },
      deviceSnapshot: {
        upsert: jest.fn().mockResolvedValue(snapshot),
      },
    } as unknown as PrismaService;
    const redis = { set: jest.fn().mockResolvedValue('OK') } as unknown as RedisService;
    const alarmEvaluator = {
      evaluate: jest.fn().mockResolvedValue({ created: [], resolved: [] }),
    } as unknown as AlarmEvaluatorService;
    const realtimeGateway = {
      emitDeviceStatusChanged: jest.fn(),
      emitTelemetryCreated: jest.fn(),
      emitSnapshotUpdated: jest.fn(),
      emitAlarmCreated: jest.fn(),
      emitAlarmUpdated: jest.fn(),
      emitScreenOverviewUpdated: jest.fn(),
      emitScreenMetricsUpdated: jest.fn(),
    } as unknown as RealtimeGateway;
    const monitorService = {
      getOverview: jest.fn().mockResolvedValue(metrics.overview),
      getScreenMetrics: jest.fn().mockResolvedValue(metrics),
    } as unknown as MonitorService;
    const service = new TelemetryIngestionService(prisma, redis, alarmEvaluator, realtimeGateway, monitorService);

    await service.handleTelemetry({
      deviceCode: device.code,
      ch4: 0.3,
      o2: 20.8,
      co: 2,
      h2s: 1,
      batteryLevel: 80,
      lng: 112.1,
      lat: 37.2,
      depth: -420,
      onlineStatus: DeviceStatus.ONLINE,
      sensorStatus: SensorStatus.NORMAL,
      reportedAt,
    });

    expect(monitorService.getScreenMetrics).toHaveBeenCalled();
    expect((realtimeGateway as any).emitScreenMetricsUpdated).toHaveBeenCalledWith(metrics);
  });
});
