import { DeviceStatus } from '@prisma/client';
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
});
