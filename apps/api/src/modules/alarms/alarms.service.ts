import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlarmSeverity, AlarmStatus, GasType, Prisma } from '@prisma/client';
import { paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmQueryDto } from './dto/alarm-query.dto';

@Injectable()
export class AlarmsService {
  constructor(private readonly prisma: PrismaService) {}

  private normalizeRemark(remark?: string) {
    const trimmed = remark?.trim();
    return trimmed ? trimmed : undefined;
  }

  private async requireAlarm(tx: Prisma.TransactionClient, id: string) {
    const alarm = await tx.alarmEvent.findUnique({ where: { id } });
    if (!alarm) {
      throw new NotFoundException('报警不存在');
    }
    return alarm;
  }

  private zeroStatusMap() {
    return { ACTIVE: 0, ACKED: 0, RESOLVED: 0 } as Record<AlarmStatus, number>;
  }

  private zeroSeverityMap() {
    return { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 } as Record<AlarmSeverity, number>;
  }

  private zeroGasTypeMap() {
    return { CH4: 0, O2: 0, CO: 0, H2S: 0, BATTERY: 0 } as Record<GasType, number>;
  }

  private auditDetail(actionText: string, alarmId: string, remark?: string) {
    return remark ? `${actionText}报警 ${alarmId}：${remark}` : `${actionText}报警 ${alarmId}`;
  }

  async findAll(query: AlarmQueryDto) {
    const where: Prisma.AlarmEventWhereInput = {
      status: query.status,
      severity: query.severity,
      gasType: query.gasType,
      deviceId: query.deviceId,
      OR: query.keyword
        ? [
            { message: { contains: query.keyword, mode: 'insensitive' } },
            { device: { code: { contains: query.keyword, mode: 'insensitive' } } },
            { device: { name: { contains: query.keyword, mode: 'insensitive' } } },
          ]
        : undefined,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.alarmEvent.findMany({
        where,
        ...pagination(query),
        include: { device: true, rule: true },
        orderBy: { startedAt: 'desc' },
      }),
      this.prisma.alarmEvent.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async findOne(id: string) {
    const alarm = await this.prisma.alarmEvent.findUnique({
      where: { id },
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
    if (!alarm) {
      throw new NotFoundException('报警不存在');
    }
    return alarm;
  }

  async ack(id: string, userId?: string, remark?: string) {
    const normalizedRemark = this.normalizeRemark(remark);
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.requireAlarm(tx, id);
      if (existing.status === AlarmStatus.RESOLVED) {
        throw new BadRequestException('已解除报警不能再次确认');
      }
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.ACKED,
          ackedAt: existing.ackedAt ?? new Date(),
          ackRemark: normalizedRemark,
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'ACK',
          remark: normalizedRemark,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'alarms',
          action: 'ACK',
          resourceId: id,
          detail: this.auditDetail('确认', id, normalizedRemark),
        },
      });
      return alarm;
    });
  }

  async resolve(id: string, userId?: string, remark?: string) {
    const normalizedRemark = this.normalizeRemark(remark);
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.requireAlarm(tx, id);
      if (existing.status === AlarmStatus.RESOLVED) {
        throw new BadRequestException('报警已解除');
      }
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.RESOLVED,
          resolvedAt: new Date(),
          resolveRemark: normalizedRemark,
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'RESOLVE',
          remark: normalizedRemark,
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'alarms',
          action: 'RESOLVE',
          resourceId: id,
          detail: this.auditDetail('解除', id, normalizedRemark),
        },
      });
      return alarm;
    });
  }

  async statistics() {
    const [byStatusGroups, bySeverityGroups, byGasTypeGroups, escalatedActive, latestActive] = await Promise.all([
      this.prisma.alarmEvent.groupBy({ by: ['status'], _count: { status: true } }),
      this.prisma.alarmEvent.groupBy({ by: ['severity'], _count: { severity: true } }),
      this.prisma.alarmEvent.groupBy({ by: ['gasType'], _count: { gasType: true } }),
      this.prisma.alarmEvent.count({
        where: {
          status: AlarmStatus.ACTIVE,
          escalationLevel: { gt: 0 },
        },
      }),
      this.prisma.alarmEvent.findMany({
        where: { status: AlarmStatus.ACTIVE },
        take: 10,
        include: { device: true, rule: true },
        orderBy: [{ escalationLevel: 'desc' }, { startedAt: 'desc' }],
      }),
    ]);

    const byStatus = this.zeroStatusMap();
    for (const item of byStatusGroups) byStatus[item.status] = item._count.status;

    const bySeverity = this.zeroSeverityMap();
    for (const item of bySeverityGroups) bySeverity[item.severity] = item._count.severity;

    const byGasType = this.zeroGasTypeMap();
    for (const item of byGasTypeGroups) byGasType[item.gasType] = item._count.gasType;

    return { byStatus, bySeverity, byGasType, escalatedActive, latestActive };
  }
}
