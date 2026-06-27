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

  create(dto: CreateBaseStationDto) {
    return this.prisma.baseStation.create({ data: dto, include: { area: true } });
  }

  update(id: string, dto: UpdateBaseStationDto) {
    return this.prisma.baseStation.update({ where: { id }, data: dto, include: { area: true } });
  }

  async remove(id: string) {
    await this.prisma.baseStation.delete({ where: { id } });
    return { id };
  }
}
