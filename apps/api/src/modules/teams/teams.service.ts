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

  create(dto: CreateTeamDto) {
    return this.prisma.team.create({ data: dto });
  }

  update(id: string, dto: UpdateTeamDto) {
    return this.prisma.team.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.team.delete({ where: { id } });
    return { id };
  }
}
