import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.TeamWhereInput = query.keyword
      ? { OR: [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.team.findMany({ where, ...pagination(query), include: { members: true }, orderBy: { createdAt: 'desc' } }),
      this.prisma.team.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  create(dto: CreateTeamDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({ data: dto });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'teams',
          action: 'CREATE',
          resourceId: team.id,
          detail: `新增班组 ${team.code} ${team.name}`,
        },
      });
      return team;
    });
  }

  update(id: string, dto: UpdateTeamDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.update({ where: { id }, data: dto });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'teams',
          action: 'UPDATE',
          resourceId: team.id,
          detail: `更新班组 ${team.code} ${team.name}`,
        },
      });
      return team;
    });
  }

  remove(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'teams',
          action: 'DELETE',
          resourceId: team.id,
          detail: `删除班组 ${team.code} ${team.name}`,
        },
      });
      return { id: team.id };
    });
  }
}
