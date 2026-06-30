import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { CalibrationResult, GasType, Prisma } from '@prisma/client';
import { paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CalibrationDueStatus, CalibrationQueryDto } from './dto/calibration-query.dto';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

export const CALIBRATION_INTERVAL_DAYS = 30;
export const CALIBRATION_DUE_SOON_DAYS = 7;
export const CALIBRATION_GAS_TYPES = [GasType.CH4, GasType.O2, GasType.CO, GasType.H2S] as const;

const calibrationInclude = {
  device: { include: { area: true, baseStation: true } },
  calibratedByUser: true,
  team: true,
} satisfies Prisma.CalibrationRecordInclude;

@Injectable()
export class CalibrationsService {
  constructor(private readonly prisma: PrismaService) {}

  evaluateResult(standardValue: number, afterValue: number) {
    const deviation = Math.abs(afterValue - standardValue);
    const deviationPercent =
      standardValue === 0
        ? Number((deviation * 100).toFixed(2))
        : Number(((deviation / Math.abs(standardValue)) * 100).toFixed(2));
    const score = standardValue === 0 ? deviation : deviationPercent;
    const passThreshold = standardValue === 0 ? 0.1 : 10;
    const recheckThreshold = standardValue === 0 ? 0.2 : 20;

    if (score <= passThreshold) {
      return { result: CalibrationResult.PASS, deviationPercent };
    }
    if (score <= recheckThreshold) {
      return { result: CalibrationResult.NEED_RECHECK, deviationPercent };
    }
    return { result: CalibrationResult.FAIL, deviationPercent };
  }

  nextDueAt(calibratedAt: Date) {
    const next = new Date(calibratedAt);
    next.setDate(next.getDate() + CALIBRATION_INTERVAL_DAYS);
    return next;
  }

  dueStatusFor(record: { result: CalibrationResult; nextDueAt: Date } | null, now = new Date()) {
    if (!record) return CalibrationDueStatus.OVERDUE;
    if (record.result === CalibrationResult.FAIL || record.result === CalibrationResult.NEED_RECHECK) {
      return CalibrationDueStatus.FAILED;
    }
    if (record.nextDueAt.getTime() < now.getTime()) return CalibrationDueStatus.OVERDUE;
    const dueSoonAt = new Date(now);
    dueSoonAt.setDate(dueSoonAt.getDate() + CALIBRATION_DUE_SOON_DAYS);
    if (record.nextDueAt.getTime() <= dueSoonAt.getTime()) return CalibrationDueStatus.DUE_SOON;
    return CalibrationDueStatus.NORMAL;
  }

  async findAll(query: CalibrationQueryDto) {
    const where = this.whereForQuery(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.calibrationRecord.findMany({
        where,
        ...pagination(query),
        include: calibrationInclude,
        orderBy: { calibratedAt: 'desc' },
      }),
      this.prisma.calibrationRecord.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async overview(now = new Date()) {
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);
    const [totalRecords, todayCompleted, failedRecords, needRecheckRecords, dueItems] = await Promise.all([
      this.prisma.calibrationRecord.count(),
      this.prisma.calibrationRecord.count({ where: { calibratedAt: { gte: startOfToday } } }),
      this.prisma.calibrationRecord.count({ where: { result: CalibrationResult.FAIL } }),
      this.prisma.calibrationRecord.count({ where: { result: CalibrationResult.NEED_RECHECK } }),
      this.dueDevices(now),
    ]);

    return {
      totalRecords,
      todayCompleted,
      dueSoonItems: dueItems.filter((item) => item.dueStatus === CalibrationDueStatus.DUE_SOON).length,
      overdueItems: dueItems.filter((item) => item.dueStatus === CalibrationDueStatus.OVERDUE).length,
      failedRecords,
      needRecheckRecords,
    };
  }

  async dueDevices(now = new Date()) {
    const [devices, records] = await Promise.all([
      this.prisma.device.findMany({
        include: { area: true, baseStation: true },
        orderBy: { code: 'asc' },
      }),
      this.prisma.calibrationRecord.findMany({
        where: { gasType: { in: [...CALIBRATION_GAS_TYPES] } },
        include: calibrationInclude,
        orderBy: { calibratedAt: 'desc' },
      }),
    ]);

    const latestByDeviceGas = new Map<string, (typeof records)[number]>();
    for (const record of records) {
      const key = `${record.deviceId}:${record.gasType}`;
      if (!latestByDeviceGas.has(key)) latestByDeviceGas.set(key, record);
    }

    return devices.flatMap((device) =>
      CALIBRATION_GAS_TYPES.map((gasType) => {
        const latestCalibration = latestByDeviceGas.get(`${device.id}:${gasType}`) ?? null;
        return {
          deviceId: device.id,
          deviceCode: device.code,
          deviceName: device.name,
          gasType,
          areaName: device.area?.name,
          baseStationName: device.baseStation?.name,
          latestCalibration,
          nextDueAt: latestCalibration?.nextDueAt,
          dueStatus: this.dueStatusFor(latestCalibration, now),
        };
      }),
    );
  }

  async create(dto: CreateCalibrationDto, userId?: string) {
    const device = await this.prisma.device.findUnique({ where: { id: dto.deviceId } });
    if (!device) throw new NotFoundException('设备不存在');

    const calibratedByUser = dto.calibratedById
      ? await this.prisma.personnel.findUnique({ where: { id: dto.calibratedById } })
      : null;
    if (dto.calibratedById && !calibratedByUser) {
      throw new BadRequestException('标定人员不存在');
    }

    const team = dto.teamId ? await this.prisma.team.findUnique({ where: { id: dto.teamId } }) : null;
    if (dto.teamId && !team) {
      throw new BadRequestException('班组不存在');
    }

    const calibratedAt = new Date(dto.calibratedAt);
    const { result, deviationPercent } = this.evaluateResult(dto.standardValue, dto.afterValue);
    const nextDueAt = this.nextDueAt(calibratedAt);
    const calibratedBy = calibratedByUser?.name ?? dto.calibratedBy ?? '未填写';

    return this.prisma.$transaction(async (tx) => {
      const record = await tx.calibrationRecord.create({
        data: {
          deviceId: dto.deviceId,
          gasType: dto.gasType,
          beforeValue: dto.beforeValue,
          afterValue: dto.afterValue,
          standardValue: dto.standardValue,
          calibratedBy,
          calibratedById: dto.calibratedById,
          teamId: dto.teamId,
          result,
          deviationPercent,
          nextDueAt,
          notes: dto.notes,
          calibratedAt,
        },
        include: calibrationInclude,
      });
      const detail = this.auditDetail(
        record.device?.code ?? device.code,
        dto.gasType,
        dto.standardValue,
        dto.afterValue,
        deviationPercent,
        result,
      );
      await tx.auditLog.create({
        data: {
          userId,
          module: 'calibrations',
          action: 'CREATE',
          resourceId: record.id,
          detail,
        },
      });
      if (result !== CalibrationResult.PASS) {
        await tx.auditLog.create({
          data: {
            userId,
            module: 'calibrations',
            action: 'CALIBRATION_WARNING',
            resourceId: record.id,
            detail,
          },
        });
      }
      return record;
    });
  }

  private whereForQuery(query: CalibrationQueryDto): Prisma.CalibrationRecordWhereInput {
    const dueWhere = this.dueWhere(query.dueStatus);
    return {
      deviceId: query.deviceId,
      gasType: query.gasType,
      result: query.result,
      teamId: query.teamId,
      calibratedById: query.calibratedById,
      ...dueWhere,
      OR: query.keyword
        ? [
            { device: { code: { contains: query.keyword, mode: 'insensitive' } } },
            { device: { name: { contains: query.keyword, mode: 'insensitive' } } },
            { calibratedBy: { contains: query.keyword, mode: 'insensitive' } },
          ]
        : undefined,
    };
  }

  private dueWhere(dueStatus?: CalibrationDueStatus): Prisma.CalibrationRecordWhereInput {
    if (!dueStatus) return {};
    const now = new Date();
    const dueSoonAt = new Date(now);
    dueSoonAt.setDate(dueSoonAt.getDate() + CALIBRATION_DUE_SOON_DAYS);
    if (dueStatus === CalibrationDueStatus.FAILED) {
      return { result: { in: [CalibrationResult.FAIL, CalibrationResult.NEED_RECHECK] } };
    }
    if (dueStatus === CalibrationDueStatus.OVERDUE) {
      return { result: CalibrationResult.PASS, nextDueAt: { lt: now } };
    }
    if (dueStatus === CalibrationDueStatus.DUE_SOON) {
      return { result: CalibrationResult.PASS, nextDueAt: { gte: now, lte: dueSoonAt } };
    }
    return { result: CalibrationResult.PASS, nextDueAt: { gt: dueSoonAt } };
  }

  private auditDetail(
    deviceCode: string,
    gasType: GasType,
    standardValue: number,
    afterValue: number,
    deviationPercent: number,
    result: CalibrationResult,
  ) {
    return `设备 ${deviceCode} ${gasType} 标定完成：标准值 ${standardValue}，标定后 ${afterValue}，偏差 ${deviationPercent.toFixed(2)}%，结果 ${result}`;
  }
}
