import { AlarmStatus, DeviceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MonitorService } from './monitor.service';

describe('MonitorService', () => {
  it('computes overview counters from devices, snapshots, and alarms', async () => {
    const prisma = {
      device: { count: jest.fn().mockResolvedValue(100) },
      deviceSnapshot: {
        count: jest.fn()
          .mockResolvedValueOnce(82)
          .mockResolvedValueOnce(12)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(9),
      },
      alarmEvent: { count: jest.fn().mockResolvedValue(4) },
    } as unknown as PrismaService;
    const service = new MonitorService(prisma);

    await expect(service.getOverview()).resolves.toEqual({
      totalDevices: 100,
      onlineDevices: 82,
      offlineDevices: 12,
      faultDevices: 6,
      activeAlarms: 4,
      lowBatteryDevices: 9,
    });

    expect(prisma.deviceSnapshot.count).toHaveBeenNthCalledWith(1, { where: { status: DeviceStatus.ONLINE } });
  });

  it('includes escalated alarms in area risk ranking', async () => {
    const prisma = {
      area: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'area-1',
            name: 'A区',
            riskLevel: 3,
            devices: [
              {
                snapshot: { status: DeviceStatus.FAULT, batteryLevel: 15 },
                alarms: [
                  { status: AlarmStatus.ACTIVE, escalationLevel: 1 },
                  { status: AlarmStatus.ACTIVE, escalationLevel: 0 },
                ],
              },
              {
                snapshot: { status: DeviceStatus.ONLINE, batteryLevel: 80 },
                alarms: [],
              },
            ],
          },
          {
            id: 'area-2',
            name: 'B区',
            riskLevel: 1,
            devices: [
              {
                snapshot: { status: DeviceStatus.ONLINE, batteryLevel: 50 },
                alarms: [{ status: AlarmStatus.ACTIVE, escalationLevel: 0 }],
              },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new MonitorService(prisma);

    const result = await service.getAreaRiskRanking();

    expect(prisma.area.findMany).toHaveBeenCalledWith({
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
    expect(result[0]).toEqual({
      areaId: 'area-1',
      areaName: 'A区',
      activeAlarms: 2,
      escalatedAlarms: 1,
      faultDevices: 1,
      lowBatteryDevices: 1,
      riskScore: 38,
    });
    expect(result[1]).toEqual(expect.objectContaining({ areaId: 'area-2', escalatedAlarms: 0, riskScore: 11 }));
  });
});
