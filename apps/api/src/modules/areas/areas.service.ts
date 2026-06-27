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

  create(dto: CreateAreaDto) {
    return this.prisma.area.create({ data: { ...dto, riskLevel: dto.riskLevel ?? 1 } });
  }

  update(id: string, dto: UpdateAreaDto) {
    return this.prisma.area.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.area.delete({ where: { id } });
    return { id };
  }
}
