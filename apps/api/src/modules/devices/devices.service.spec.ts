import { DeviceStatus, SensorStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DevicesService } from './devices.service';

describe('DevicesService', () => {
  it('creates a device with an initial snapshot', async () => {
    const prisma = {
      device: {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'device-1', code: 'GAS-0001' }),
      },
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await service.create({
      code: 'GAS-0001',
      name: '四合一气体检测仪 001',
      model: 'GD4-MINE',
      serialNumber: 'SN-GAS-0001',
    });

    expect(prisma.device.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        code: 'GAS-0001',
        status: DeviceStatus.OFFLINE,
        snapshot: {
          create: expect.objectContaining({
            status: DeviceStatus.OFFLINE,
            sensorStatus: SensorStatus.NORMAL,
          }),
        },
      }),
      include: expect.any(Object),
    });
  });

  it('returns device calibration history with pagination and gas filter', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'cal-1' }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      calibrationRecord: { findMany, count },
      $transaction: jest.fn(async (queries) => Promise.all(queries)),
    } as unknown as PrismaService;
    const service = new DevicesService(prisma);

    await expect(
      service.findCalibrations('device-1', { page: 1, pageSize: 5, gasType: 'CH4' as any }),
    ).resolves.toEqual({
      items: [{ id: 'cal-1' }],
      total: 1,
      page: 1,
      pageSize: 5,
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { deviceId: 'device-1', gasType: 'CH4' },
      skip: 0,
      take: 5,
      orderBy: { calibratedAt: 'desc' },
      include: { calibratedByUser: true, team: true },
    });
  });
});
