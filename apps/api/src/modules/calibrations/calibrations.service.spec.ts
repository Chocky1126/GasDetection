import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CalibrationResult, GasType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CalibrationsService } from './calibrations.service';
import { CalibrationDueStatus } from './dto/calibration-query.dto';

describe('CalibrationsService', () => {
  const calibratedAt = new Date('2026-06-30T08:00:00.000Z');

  afterEach(() => {
    jest.useRealTimers();
  });

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

    const serviceMissingTeam = new CalibrationsService({
      device: { findUnique: jest.fn().mockResolvedValue({ id: 'device-1' }) },
      team: { findUnique: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService);

    await expect(
      serviceMissingTeam.create({
        deviceId: 'device-1',
        gasType: GasType.CH4,
        standardValue: 1,
        beforeValue: 1,
        afterValue: 1,
        teamId: 'missing-team',
        calibratedAt: calibratedAt.toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('calculates due status boundaries', () => {
    const service = new CalibrationsService({} as PrismaService);
    const now = new Date('2026-06-30T08:00:00.000Z');

    expect(service.dueStatusFor(null, now)).toBe(CalibrationDueStatus.OVERDUE);
    expect(service.dueStatusFor({ result: CalibrationResult.FAIL, nextDueAt: now }, now)).toBe(
      CalibrationDueStatus.FAILED,
    );
    expect(service.dueStatusFor({ result: CalibrationResult.NEED_RECHECK, nextDueAt: now }, now)).toBe(
      CalibrationDueStatus.FAILED,
    );
    expect(
      service.dueStatusFor({ result: CalibrationResult.PASS, nextDueAt: new Date('2026-06-30T07:59:59.999Z') }, now),
    ).toBe(CalibrationDueStatus.OVERDUE);
    expect(
      service.dueStatusFor({ result: CalibrationResult.PASS, nextDueAt: new Date('2026-07-07T08:00:00.000Z') }, now),
    ).toBe(CalibrationDueStatus.DUE_SOON);
    expect(
      service.dueStatusFor({ result: CalibrationResult.PASS, nextDueAt: new Date('2026-07-07T08:00:00.001Z') }, now),
    ).toBe(CalibrationDueStatus.NORMAL);
  });

  it('forwards list filters into Prisma where', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'cal-1' }]);
    const count = jest.fn().mockResolvedValue(1);
    const prisma = {
      calibrationRecord: { findMany, count },
      $transaction: jest.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    const result = await service.findAll({
      page: 1,
      pageSize: 20,
      keyword: 'GAS-0001',
      gasType: GasType.CH4,
      result: CalibrationResult.NEED_RECHECK,
      teamId: 'team-1',
      calibratedById: 'person-1',
    });

    expect(result).toEqual({ items: [{ id: 'cal-1' }], total: 1, page: 1, pageSize: 20 });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deviceId: undefined,
          gasType: GasType.CH4,
          result: CalibrationResult.NEED_RECHECK,
          teamId: 'team-1',
          calibratedById: 'person-1',
          OR: [
            { device: { code: { contains: 'GAS-0001', mode: 'insensitive' } } },
            { device: { name: { contains: 'GAS-0001', mode: 'insensitive' } } },
            { calibratedBy: { contains: 'GAS-0001', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 20,
        include: expect.any(Object),
        orderBy: { calibratedAt: 'desc' },
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        deviceId: undefined,
        gasType: GasType.CH4,
        result: CalibrationResult.NEED_RECHECK,
        teamId: 'team-1',
        calibratedById: 'person-1',
        OR: [
          { device: { code: { contains: 'GAS-0001', mode: 'insensitive' } } },
          { device: { name: { contains: 'GAS-0001', mode: 'insensitive' } } },
          { calibratedBy: { contains: 'GAS-0001', mode: 'insensitive' } },
        ],
      },
    });
  });

  it('forwards due status into Prisma where', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-30T08:00:00.000Z'));
    const findMany = jest.fn().mockResolvedValue([]);
    const count = jest.fn().mockResolvedValue(0);
    const prisma = {
      calibrationRecord: { findMany, count },
      $transaction: jest.fn(async (operations) => Promise.all(operations)),
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    await service.findAll({
      page: 1,
      pageSize: 20,
      dueStatus: CalibrationDueStatus.DUE_SOON,
    });

    const where = {
      deviceId: undefined,
      gasType: undefined,
      result: CalibrationResult.PASS,
      teamId: undefined,
      calibratedById: undefined,
      nextDueAt: {
        gte: new Date('2026-06-30T08:00:00.000Z'),
        lte: new Date('2026-07-07T08:00:00.000Z'),
      },
      OR: undefined,
    };
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where }));
    expect(count).toHaveBeenCalledWith({ where });
  });

  it('returns calibration overview counters', async () => {
    const dueDevices = jest.fn().mockResolvedValue([
      { dueStatus: 'DUE_SOON' },
      { dueStatus: 'OVERDUE' },
      { dueStatus: 'FAILED' },
    ]);
    const prisma = {
      calibrationRecord: {
        count: jest
          .fn()
          .mockResolvedValueOnce(20)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(3)
          .mockResolvedValueOnce(4),
      },
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);
    jest.spyOn(service, 'dueDevices').mockImplementation(dueDevices);

    await expect(service.overview(new Date('2026-06-30T12:00:00.000Z'))).resolves.toEqual({
      totalRecords: 20,
      todayCompleted: 2,
      dueSoonItems: 1,
      overdueItems: 1,
      failedRecords: 3,
      needRecheckRecords: 4,
    });
  });

  it('returns due status for each device and calibration gas type', async () => {
    const now = new Date('2026-06-30T00:00:00.000Z');
    const prisma = {
      device: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'device-1', code: 'GAS-0001', name: '设备1', area: { name: '一采区' }, baseStation: { name: 'BS-01' } },
        ]),
      },
      calibrationRecord: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'cal-1',
            deviceId: 'device-1',
            gasType: GasType.CH4,
            result: CalibrationResult.PASS,
            nextDueAt: new Date('2026-07-03T00:00:00.000Z'),
            calibratedAt: new Date('2026-06-03T00:00:00.000Z'),
          },
          {
            id: 'cal-2',
            deviceId: 'device-1',
            gasType: GasType.O2,
            result: CalibrationResult.FAIL,
            nextDueAt: new Date('2026-07-30T00:00:00.000Z'),
            calibratedAt: new Date('2026-06-30T00:00:00.000Z'),
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new CalibrationsService(prisma);

    const result = await service.dueDevices(now);

    expect(result).toEqual([
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.CH4, dueStatus: 'DUE_SOON' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.O2, dueStatus: 'FAILED' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.CO, dueStatus: 'OVERDUE' }),
      expect.objectContaining({ deviceId: 'device-1', gasType: GasType.H2S, dueStatus: 'OVERDUE' }),
    ]);
  });
});
