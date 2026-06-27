import { Injectable } from '@nestjs/common';
import { AlarmStatus, Prisma } from '@prisma/client';
import { paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmQueryDto } from './dto/alarm-query.dto';

@Injectable()
export class AlarmsService {
  constructor(private readonly prisma: PrismaService) {}

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

  findOne(id: string) {
    return this.prisma.alarmEvent.findUnique({
      where: { id },
      include: { device: true, rule: true, actions: true },
    });
  }

  async ack(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.ACKED,
          ackedAt: new Date(),
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'ACK',
        },
      });
      return alarm;
    });
  }

  async resolve(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const alarm = await tx.alarmEvent.update({
        where: { id },
        data: {
          status: AlarmStatus.RESOLVED,
          resolvedAt: new Date(),
        },
      });
      await tx.alarmActionLog.create({
        data: {
          alarmId: id,
          userId,
          action: 'RESOLVE',
        },
      });
      return alarm;
    });
  }
}
