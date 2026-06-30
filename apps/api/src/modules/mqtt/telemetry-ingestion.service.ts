import { Injectable, Logger } from '@nestjs/common';
import { DeviceStatus } from '@prisma/client';
import { AlarmEvaluatorService } from '../alarms/alarm-evaluator.service';
import { MonitorService } from '../monitor/monitor.service';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { RedisService } from '../redis/redis.service';
import { TelemetryPayload } from './telemetry-payload';

@Injectable()
export class TelemetryIngestionService {
  private readonly logger = new Logger(TelemetryIngestionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly alarmEvaluator: AlarmEvaluatorService,
    private readonly realtimeGateway: RealtimeGateway,
    private readonly monitorService: MonitorService,
  ) {}

  async handleTelemetry(payload: TelemetryPayload) {
    const device = await this.prisma.device.findUnique({
      where: { code: payload.deviceCode },
      include: { snapshot: true },
    });
    if (!device) {
      this.logger.warn(`Unknown device telemetry ignored: ${payload.deviceCode}`);
      return null;
    }

    const reportedAt = new Date(payload.reportedAt);
    const telemetry = await this.prisma.telemetryRecord.create({
      data: {
        deviceId: device.id,
        ch4: payload.ch4,
        o2: payload.o2,
        co: payload.co,
        h2s: payload.h2s,
        batteryLevel: payload.batteryLevel,
        lng: payload.lng,
        lat: payload.lat,
        depth: payload.depth,
        onlineStatus: payload.onlineStatus,
        sensorStatus: payload.sensorStatus,
        reportedAt,
      },
    });

    const nextStatus = payload.sensorStatus === 'FAULT' ? DeviceStatus.FAULT : payload.onlineStatus;
    const snapshot = await this.prisma.deviceSnapshot.upsert({
      where: { deviceId: device.id },
      update: {
        ch4: payload.ch4,
        o2: payload.o2,
        co: payload.co,
        h2s: payload.h2s,
        batteryLevel: payload.batteryLevel,
        lng: payload.lng,
        lat: payload.lat,
        depth: payload.depth,
        status: nextStatus,
        sensorStatus: payload.sensorStatus,
        lastSeenAt: reportedAt,
      },
      create: {
        deviceId: device.id,
        ch4: payload.ch4,
        o2: payload.o2,
        co: payload.co,
        h2s: payload.h2s,
        batteryLevel: payload.batteryLevel,
        lng: payload.lng,
        lat: payload.lat,
        depth: payload.depth,
        status: nextStatus,
        sensorStatus: payload.sensorStatus,
        lastSeenAt: reportedAt,
      },
    });

    if (device.status !== nextStatus) {
      await this.prisma.device.update({ where: { id: device.id }, data: { status: nextStatus } });
      this.realtimeGateway.emitDeviceStatusChanged({ deviceCode: device.code, status: nextStatus });
    }

    await this.redis.set(`device:snapshot:${device.code}`, JSON.stringify(snapshot), 120);

    const alarmChanges = await this.alarmEvaluator.evaluate({
      deviceId: device.id,
      deviceCode: device.code,
      telemetry: payload,
    });

    this.realtimeGateway.emitTelemetryCreated({ deviceCode: device.code, telemetry });
    this.realtimeGateway.emitSnapshotUpdated({ deviceCode: device.code, snapshot });
    for (const alarm of alarmChanges.created) {
      this.realtimeGateway.emitAlarmCreated(alarm);
    }
    for (const alarm of alarmChanges.resolved) {
      this.realtimeGateway.emitAlarmUpdated(alarm);
    }
    this.realtimeGateway.emitScreenMetricsUpdated(await this.monitorService.getScreenMetrics());

    return { telemetry, snapshot, alarmChanges };
  }
}
