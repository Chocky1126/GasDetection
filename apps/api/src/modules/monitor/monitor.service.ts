import { Injectable } from '@nestjs/common';
import { AlarmStatus, DeviceStatus } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';

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

  async getAreaRiskRanking() {
    const areas = await this.prisma.area.findMany({
      include: {
        devices: {
          include: {
            snapshot: true,
            alarms: {
              where: { status: AlarmStatus.ACTIVE },
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
        return {
          areaId: area.id,
          areaName: area.name,
          activeAlarms,
          escalatedAlarms,
          faultDevices,
          lowBatteryDevices,
          riskScore: activeAlarms * 10 + escalatedAlarms * 8 + faultDevices * 5 + lowBatteryDevices * 2 + area.riskLevel,
        };
      })
      .sort((left, right) => right.riskScore - left.riskScore);
  }
}
