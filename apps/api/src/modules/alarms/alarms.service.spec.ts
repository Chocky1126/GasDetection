import { AlarmStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmsService } from './alarms.service';

describe('AlarmsService', () => {
  it('acknowledges an active alarm and records an action', async () => {
    const alarmUpdate = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED });
    const actionCreate = jest.fn().mockResolvedValue({ id: 'action-1' });
    const prisma = {
      alarmEvent: {
        update: alarmUpdate,
      },
      alarmActionLog: {
        create: actionCreate,
      },
      $transaction: jest.fn(async (callback) => callback({
        alarmEvent: { update: alarmUpdate },
        alarmActionLog: { create: actionCreate },
      })),
    } as unknown as PrismaService;
    const service = new AlarmsService(prisma);

    const result = await service.ack('alarm-1', 'user-1');

    expect(result.status).toBe(AlarmStatus.ACKED);
    expect(alarmUpdate).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.ACKED,
        ackedAt: expect.any(Date),
      }),
    });
    expect(actionCreate).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-1',
        action: 'ACK',
      },
    });
  });
});
