import { AlarmStatus, CalibrationResult, DeviceStatus, GasType } from '@prisma/client';
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
                calibrations: [],
              },
              {
                snapshot: { status: DeviceStatus.ONLINE, batteryLevel: 80 },
                alarms: [],
                calibrations: [],
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
                calibrations: [],
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
            calibrations: {
              where: { gasType: { in: [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S] } },
              orderBy: { calibratedAt: 'desc' },
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
      calibrationFailedItems: 0,
      calibrationOverdueItems: 0,
      riskScore: 38,
    });
    expect(result[1]).toEqual(expect.objectContaining({ areaId: 'area-2', escalatedAlarms: 0, riskScore: 11 }));
  });

  it('adds latest failed and overdue calibration items to area risk ranking', async () => {
    const prisma = {
      area: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'area-1',
            name: 'A区',
            riskLevel: 1,
            devices: [
              {
                snapshot: { status: DeviceStatus.ONLINE, batteryLevel: 80 },
                alarms: [],
                calibrations: [
                  {
                    deviceId: 'device-1',
                    gasType: GasType.CH4,
                    result: CalibrationResult.FAIL,
                    nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-30T10:00:00.000Z'),
                  },
                  {
                    deviceId: 'device-1',
                    gasType: GasType.CH4,
                    result: CalibrationResult.PASS,
                    nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-01T10:00:00.000Z'),
                  },
                  {
                    deviceId: 'device-1',
                    gasType: GasType.O2,
                    result: CalibrationResult.NEED_RECHECK,
                    nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-30T10:00:00.000Z'),
                  },
                  {
                    deviceId: 'device-1',
                    gasType: GasType.CO,
                    result: CalibrationResult.PASS,
                    nextDueAt: new Date('2020-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-30T10:00:00.000Z'),
                  },
                  {
                    deviceId: 'device-1',
                    gasType: GasType.H2S,
                    result: CalibrationResult.PASS,
                    nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-30T10:00:00.000Z'),
                  },
                ],
              },
              {
                snapshot: { status: DeviceStatus.ONLINE, batteryLevel: 80 },
                alarms: [],
                calibrations: [
                  {
                    deviceId: 'device-2',
                    gasType: GasType.CH4,
                    result: CalibrationResult.PASS,
                    nextDueAt: new Date('2099-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-30T10:00:00.000Z'),
                  },
                  {
                    deviceId: 'device-2',
                    gasType: GasType.CH4,
                    result: CalibrationResult.FAIL,
                    nextDueAt: new Date('2020-01-01T00:00:00.000Z'),
                    calibratedAt: new Date('2026-06-01T10:00:00.000Z'),
                  },
                ],
              },
            ],
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new MonitorService(prisma);

    const result = await service.getAreaRiskRanking();

    expect(result[0]).toEqual(expect.objectContaining({
      areaId: 'area-1',
      calibrationFailedItems: 2,
      calibrationOverdueItems: 1,
      riskScore: 16,
    }));
  });

  it('builds a complete realtime metrics payload for the data screen', async () => {
    const service = new MonitorService({} as PrismaService);
    const overview = { totalDevices: 100, activeAlarms: 3 };
    const trends = [{ deviceId: 'device-1', ch4: 0.3 }];
    const statusDistribution = [{ status: DeviceStatus.ONLINE, count: 82 }];
    const areaRiskRanking = [{ areaId: 'area-1', areaName: 'A区', riskScore: 25 }];
    jest.spyOn(service, 'getOverview').mockResolvedValue(overview as any);
    jest.spyOn(service, 'getTrends').mockResolvedValue(trends as any);
    jest.spyOn(service, 'getStatusDistribution').mockResolvedValue(statusDistribution as any);
    jest.spyOn(service, 'getAreaRiskRanking').mockResolvedValue(areaRiskRanking as any);

    const getScreenMetrics = (service as any).getScreenMetrics;
    expect(typeof getScreenMetrics).toBe('function');

    await expect(getScreenMetrics.call(service)).resolves.toEqual({
      overview,
      trends,
      statusDistribution,
      areaRiskRanking,
    });

    expect(service.getTrends).toHaveBeenCalledWith(120);
  });
});
