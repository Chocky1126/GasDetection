import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAreaDto } from './dto/create-area.dto';
import { UpdateAreaDto } from './dto/update-area.dto';

@Injectable()
export class AreasService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.AreaWhereInput = query.keyword
      ? {
          OR: [
            { code: { contains: query.keyword, mode: 'insensitive' } },
            { name: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.area.findMany({ where, ...pagination(query), orderBy: { createdAt: 'desc' } }),
      this.prisma.area.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  create(dto: CreateAreaDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.create({ data: { ...dto, riskLevel: dto.riskLevel ?? 1 } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'areas',
          action: 'CREATE',
          resourceId: area.id,
          detail: `新增区域 ${area.code} ${area.name}`,
        },
      });
      return area;
    });
  }

  update(id: string, dto: UpdateAreaDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.update({ where: { id }, data: dto });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'areas',
          action: 'UPDATE',
          resourceId: area.id,
          detail: `更新区域 ${area.code} ${area.name}`,
        },
      });
      return area;
    });
  }

  remove(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const area = await tx.area.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'areas',
          action: 'DELETE',
          resourceId: area.id,
          detail: `删除区域 ${area.code} ${area.name}`,
        },
      });
      return { id: area.id };
    });
  }
}
