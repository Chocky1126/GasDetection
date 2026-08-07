import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBaseStationDto } from './dto/create-base-station.dto';
import { UpdateBaseStationDto } from './dto/update-base-station.dto';

@Injectable()
export class BaseStationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.BaseStationWhereInput = query.keyword
      ? {
          OR: [
            { code: { contains: query.keyword, mode: 'insensitive' } },
            { name: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.baseStation.findMany({ where, ...pagination(query), include: { area: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.baseStation.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  create(dto: CreateBaseStationDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const station = await tx.baseStation.create({ data: dto, include: { area: true } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'base-stations',
          action: 'CREATE',
          resourceId: station.id,
          detail: `新增基站 ${station.code} ${station.name}`,
        },
      });
      return station;
    });
  }

  update(id: string, dto: UpdateBaseStationDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const station = await tx.baseStation.update({ where: { id }, data: dto, include: { area: true } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'base-stations',
          action: 'UPDATE',
          resourceId: station.id,
          detail: `更新基站 ${station.code} ${station.name}`,
        },
      });
      return station;
    });
  }

  remove(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const station = await tx.baseStation.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'base-stations',
          action: 'DELETE',
          resourceId: station.id,
          detail: `删除基站 ${station.code} ${station.name}`,
        },
      });
      return { id: station.id };
    });
  }
}
