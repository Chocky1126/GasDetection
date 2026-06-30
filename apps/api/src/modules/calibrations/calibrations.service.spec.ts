import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalibrationResult, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalibrationsService } from './calibrations.service';

describe('CalibrationsService', () => {
  const calibratedAt = new Date('2026-06-30T08:00:00.000Z');

  it('calculates pass, recheck, fail, and zero-standard results', () => {
    const service = new CalibrationsService({} as PrismaService);

    expect(service.evaluateResult(100, 108)).toEqual({ result: CalibrationResult.PASS, deviationPercent: 8 });
    expect(service.evaluateResult(100, 115)).toEqual({ result: CalibrationResult.NEED_RECHECK, deviationPercent: 15 });
    expect(service.evaluateResult(100, 130)).toEqual({ result: CalibrationResult.FAIL, deviationPercent: 30 });
    expect(service.evaluateResult(0, 0.08)).toEqual({ result: CalibrationResult.PASS, deviationPercent: 8 });
    expect(service.evaluateResult(0, 0.15)).toEqual({ result: CalibrationResult.NEED_RECHECK, deviationPercent: 15 });
    expect(service.evaluateResult(0, 0.3)).toEqual({ result: CalibrationResult.FAIL, deviationPercent: 30 });
  });

  it('creates a calibration with personnel, team, computed result, next due date, and audit logs', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'cal-1', result: CalibrationResult.NEED_RECHECK });
    const auditCreate = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const prisma = {
      device: {
        findUnique: jest.fn().mockResolvedValue({ id: 'device-1', code: 'GAS-0001', name: '四合一气体检测仪 001' }),
      },
      personnel: {
        findUnique: jest.fn().mockResolvedValue({ id: 'person-1', name: '张三' }),
      },
      team: {
        findUnique: jest.fn().mockResolvedValue({ id: 'team-1', name: '甲班' }),
      },
      calibrationRecord: { create },
      auditLog: { create: auditCreate },
      $transaction: jest.fn(async (callback) =>
        callback({
          calibrationRecord: { create },
          auditLog: { create: auditCreate },
        }),
      ),
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    const result = await service.create(
      {
        deviceId: 'device-1',
        gasType: GasType.CH4,
        standardValue: 100,
        beforeValue: 93,
        afterValue: 115,
        calibratedById: 'person-1',
        teamId: 'team-1',
        calibratedAt: calibratedAt.toISOString(),
        notes: '复检一次',
      },
      'user-1',
    );

    expect(result).toEqual({ id: 'cal-1', result: CalibrationResult.NEED_RECHECK });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        deviceId: 'device-1',
        gasType: GasType.CH4,
        standardValue: 100,
        beforeValue: 93,
        afterValue: 115,
        calibratedById: 'person-1',
        teamId: 'team-1',
        calibratedBy: '张三',
        result: CalibrationResult.NEED_RECHECK,
        deviationPercent: 15,
        calibratedAt,
        nextDueAt: new Date('2026-07-30T08:00:00.000Z'),
      }),
      include: expect.any(Object),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        module: 'calibrations',
        action: 'CREATE',
        resourceId: 'cal-1',
      }),
    });
    expect(auditCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        module: 'calibrations',
        action: 'CALIBRATION_WARNING',
        resourceId: 'cal-1',
      }),
    });
  });

  it('throws when device, personnel, or team cannot be found', async () => {
    const serviceMissingDevice = new CalibrationsService({
      device: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(
      serviceMissingDevice.create({
        deviceId: 'missing',
        gasType: GasType.CH4,
        standardValue: 1,
        beforeValue: 1,
        afterValue: 1,
        calibratedAt: calibratedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const serviceMissingPersonnel = new CalibrationsService({
      device: { findUnique: jest.fn().mockResolvedValue({ id: 'device-1' }) },
      personnel: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(
      serviceMissingPersonnel.create({
        deviceId: 'device-1',
        gasType: GasType.CH4,
        standardValue: 1,
        beforeValue: 1,
        afterValue: 1,
        calibratedById: 'missing-person',
        calibratedAt: calibratedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
