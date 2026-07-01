import { Injectable } from '@nestjs/common';
import { AlarmStatus, CalibrationResult, DeviceStatus, GasType } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';

const RISK_CALIBRATION_GAS_TYPES = [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S] as const;

@Injectable()
export class MonitorService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [totalDevices, onlineDevices, offlineDevices, faultDevices, activeAlarms, lowBatteryDevices] = await Promise.all([
      this.prisma.device.count(),
      this.prisma.deviceSnapshot.count({ where: { status: DeviceStatus.ONLINE } }),
      this.prisma.deviceSnapshot.count({ where: { status: DeviceStatus.OFFLINE } }),
      this.prisma.deviceSnapshot.count({ where: { status: DeviceStatus.FAULT } }),
      this.prisma.alarmEvent.count({ where: { status: AlarmStatus.ACTIVE } }),
      this.prisma.deviceSnapshot.count({ where: { batteryLevel: { lt: 20 } } }),
    ]);

    return {
      totalDevices,
      onlineDevices,
      offlineDevices,
      faultDevices,
      activeAlarms,
      lowBatteryDevices,
    };
  }

  async getSnapshots(query: ListQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.deviceSnapshot.findMany({
        ...pagination(query),
        include: { device: { include: { area: true, baseStation: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.deviceSnapshot.count(),
    ]);
    return paginated(items, total, query);
  }

  async getTrends(limit = 120) {
    const records = await this.prisma.telemetryRecord.findMany({
      take: limit,
      orderBy: { reportedAt: 'desc' },
      include: { device: { select: { code: true, name: true } } },
    });
    return records.reverse();
  }

  async getStatusDistribution() {
    const groups = await this.prisma.deviceSnapshot.groupBy({
      by: ['status'],
      _count: { status: true },
    });
    return groups.map((item) => ({ status: item.status, count: item._count.status }));
  }

  async getAreaRiskRanking(now = new Date()) {
    const areas = await this.prisma.area.findMany({
      include: {
        devices: {
          include: {
            snapshot: true,
            alarms: {
              where: { status: AlarmStatus.ACTIVE },
            },
            calibrations: {
              where: { gasType: { in: [...RISK_CALIBRATION_GAS_TYPES] } },
              orderBy: { calibratedAt: 'desc' },
            },
          },
        },
      },
    });

    return areas
      .map((area) => {
        const activeAlarms = area.devices.reduce((sum, device) => sum + device.alarms.length, 0);
        const escalatedAlarms = area.devices.reduce(
          (sum, device) => sum + device.alarms.filter((alarm) => alarm.escalationLevel > 0).length,
          0,
        );
        const faultDevices = area.devices.filter((device) => device.snapshot?.status === DeviceStatus.FAULT).length;
        const lowBatteryDevices = area.devices.filter((device) => (device.snapshot?.batteryLevel ?? 100) < 20).length;
        const calibrationRisk = area.devices.reduce(
          (total, device) => {
            const risk = this.calibrationRiskForDevice(device, now);
            return {
              failedItems: total.failedItems + risk.failedItems,
              overdueItems: total.overdueItems + risk.overdueItems,
            };
          },
          { failedItems: 0, overdueItems: 0 },
        );
        return {
          areaId: area.id,
          areaName: area.name,
          activeAlarms,
          escalatedAlarms,
          faultDevices,
          lowBatteryDevices,
          calibrationFailedItems: calibrationRisk.failedItems,
          calibrationOverdueItems: calibrationRisk.overdueItems,
          riskScore:
            activeAlarms * 10 +
            escalatedAlarms * 8 +
            faultDevices * 5 +
            lowBatteryDevices * 2 +
            calibrationRisk.failedItems * 6 +
            calibrationRisk.overdueItems * 3 +
            area.riskLevel,
        };
      })
      .sort((left, right) => right.riskScore - left.riskScore);
  }

  private calibrationRiskForDevice(
    device: {
      calibrations?: Array<{
        gasType: GasType;
        result: CalibrationResult;
        nextDueAt: Date | string;
        calibratedAt: Date | string;
      }>;
    },
    now: Date,
  ) {
    const latestByGas = new Map<GasType, NonNullable<typeof device.calibrations>[number]>();
    for (const record of device.calibrations ?? []) {
      const existing = latestByGas.get(record.gasType);
      const calibratedAt = new Date(record.calibratedAt).getTime();
      const existingCalibratedAt = existing ? new Date(existing.calibratedAt).getTime() : Number.NEGATIVE_INFINITY;
      if (!existing || calibratedAt > existingCalibratedAt) {
        latestByGas.set(record.gasType, record);
      }
    }

    let failedItems = 0;
    let overdueItems = 0;
    for (const record of latestByGas.values()) {
      if (record.result === CalibrationResult.FAIL || record.result === CalibrationResult.NEED_RECHECK) {
        failedItems += 1;
      } else if (new Date(record.nextDueAt).getTime() < now.getTime()) {
        overdueItems += 1;
      }
    }
    return { failedItems, overdueItems };
  }

  async getScreenMetrics(limit = 120) {
    const [overview, trends, statusDistribution, areaRiskRanking] = await Promise.all([
      this.getOverview(),
      this.getTrends(limit),
      this.getStatusDistribution(),
      this.getAreaRiskRanking(),
    ]);

    return {
      overview,
      trends,
      statusDistribution,
      areaRiskRanking,
    };
  }
}
