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
});
