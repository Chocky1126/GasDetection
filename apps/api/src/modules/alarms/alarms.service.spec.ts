import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlarmSeverity, AlarmStatus, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmsService } from './alarms.service';

function serviceWithTransaction(tx: Record<string, unknown>) {
  const prisma = {
    $transaction: jest.fn(async (callback) => callback(tx)),
  } as unknown as PrismaService;
  return new AlarmsService(prisma);
}

describe('AlarmsService', () => {
  it('acknowledges an active alarm with a trimmed remark and records an action', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACTIVE, ackedAt: null });
    const update = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED, ackRemark: '已通知巡检' });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    const result = await service.ack('alarm-1', 'user-1', '  已通知巡检  ');

    expect(result.status).toBe(AlarmStatus.ACKED);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'alarm-1' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.ACKED,
        ackedAt: expect.any(Date),
        ackRemark: '已通知巡检',
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-1',
        action: 'ACK',
        remark: '已通知巡检',
      },
    });
  });

  it('normalizes a blank acknowledgement remark to undefined', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACTIVE });
    const update = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED, ackRemark: null });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    await service.ack('alarm-1', undefined, '   ');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({ ackRemark: undefined }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: undefined,
        action: 'ACK',
        remark: undefined,
      },
    });
  });

  it('preserves the first acknowledged time when acknowledging an acked alarm again', async () => {
    const ackedAt = new Date('2026-06-30T08:00:00.000Z');
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED, ackedAt });
    const update = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED, ackedAt });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    await service.ack('alarm-1', 'user-2', '补充说明');

    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.ACKED,
        ackedAt,
        ackRemark: '补充说明',
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-2',
        action: 'ACK',
        remark: '补充说明',
      },
    });
  });

  it('rejects acknowledging a resolved alarm', async () => {
    const update = jest.fn();
    const create = jest.fn();
    const service = serviceWithTransaction({
      alarmEvent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.RESOLVED }),
        update,
      },
      alarmActionLog: { create },
    });

    await expect(service.ack('alarm-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('throws not found when acknowledging or resolving a missing alarm', async () => {
    const update = jest.fn();
    const create = jest.fn();
    const service = serviceWithTransaction({
      alarmEvent: { findUnique: jest.fn().mockResolvedValue(null), update },
      alarmActionLog: { create },
    });

    await expect(service.ack('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.resolve('missing', 'user-1')).rejects.toBeInstanceOf(NotFoundException);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('resolves an acked alarm with a trimmed remark and records an action', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.ACKED });
    const update = jest.fn().mockResolvedValue({
      id: 'alarm-1',
      status: AlarmStatus.RESOLVED,
      resolveRemark: '现场复测正常',
    });
    const create = jest.fn().mockResolvedValue({ id: 'action-1' });
    const service = serviceWithTransaction({
      alarmEvent: { findUnique, update },
      alarmActionLog: { create },
    });

    const result = await service.resolve('alarm-1', 'user-1', '  现场复测正常  ');

    expect(result.status).toBe(AlarmStatus.RESOLVED);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'alarm-1' } });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      data: expect.objectContaining({
        status: AlarmStatus.RESOLVED,
        resolvedAt: expect.any(Date),
        resolveRemark: '现场复测正常',
      }),
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        alarmId: 'alarm-1',
        userId: 'user-1',
        action: 'RESOLVE',
        remark: '现场复测正常',
      },
    });
  });

  it('rejects resolving an already resolved alarm', async () => {
    const update = jest.fn();
    const create = jest.fn();
    const service = serviceWithTransaction({
      alarmEvent: {
        findUnique: jest.fn().mockResolvedValue({ id: 'alarm-1', status: AlarmStatus.RESOLVED }),
        update,
      },
      alarmActionLog: { create },
    });

    await expect(service.resolve('alarm-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(update).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it('finds one alarm with newest actions first and throws not found when missing', async () => {
    const alarm = { id: 'alarm-1', actions: [{ id: 'action-1' }] };
    const findUnique = jest.fn().mockResolvedValueOnce(alarm).mockResolvedValueOnce(null);
    const prisma = {
      alarmEvent: { findUnique },
    } as unknown as PrismaService;
    const service = new AlarmsService(prisma);

    await expect(service.findOne('alarm-1')).resolves.toBe(alarm);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'alarm-1' },
      include: {
        device: { include: { area: true, baseStation: true } },
        rule: true,
        actions: {
          include: {
            user: { select: { id: true, username: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    await expect(service.findOne('missing')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns statistics by status, severity, gas type, active escalation, and latest active alarms', async () => {
    const groupBy = jest
      .fn()
      .mockResolvedValueOnce([{ status: AlarmStatus.ACTIVE, _count: { status: 3 } }])
      .mockResolvedValueOnce([{ severity: AlarmSeverity.HIGH, _count: { severity: 2 } }])
      .mockResolvedValueOnce([{ gasType: GasType.CH4, _count: { gasType: 4 } }]);
    const count = jest.fn().mockResolvedValue(1);
    const findMany = jest.fn().mockResolvedValue([{ id: 'alarm-1' }]);
    const prisma = {
      alarmEvent: {
        groupBy,
        count,
        findMany,
      },
    } as unknown as PrismaService;
    const service = new AlarmsService(prisma);

    const result = await service.statistics();

    expect(groupBy).toHaveBeenNthCalledWith(1, { by: ['status'], _count: { status: true } });
    expect(groupBy).toHaveBeenNthCalledWith(2, { by: ['severity'], _count: { severity: true } });
    expect(groupBy).toHaveBeenNthCalledWith(3, { by: ['gasType'], _count: { gasType: true } });
    expect(count).toHaveBeenCalledWith({
      where: {
        status: AlarmStatus.ACTIVE,
        escalationLevel: { gt: 0 },
      },
    });
    expect(findMany).toHaveBeenCalledWith({
      where: { status: AlarmStatus.ACTIVE },
      take: 10,
      include: { device: true, rule: true },
      orderBy: [{ escalationLevel: 'desc' }, { startedAt: 'desc' }],
    });
    expect(result.byStatus).toEqual({
      ACTIVE: 3,
      ACKED: 0,
      RESOLVED: 0,
    });
    expect(result.bySeverity).toEqual({
      LOW: 0,
      MEDIUM: 0,
      HIGH: 2,
      CRITICAL: 0,
    });
    expect(result.byGasType).toEqual({
      CH4: 4,
      O2: 0,
      CO: 0,
      H2S: 0,
      BATTERY: 0,
    });
    expect(result.escalatedActive).toBe(1);
    expect(result.latestActive).toEqual([{ id: 'alarm-1' }]);
  });
});
