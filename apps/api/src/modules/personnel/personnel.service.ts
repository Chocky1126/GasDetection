import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonnelDto } from './dto/create-personnel.dto';
import { UpdatePersonnelDto } from './dto/update-personnel.dto';

@Injectable()
export class PersonnelService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.PersonnelWhereInput = query.keyword
      ? { OR: [{ code: { contains: query.keyword, mode: 'insensitive' } }, { name: { contains: query.keyword, mode: 'insensitive' } }] }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.personnel.findMany({
        where,
        ...pagination(query),
        include: { teams: { include: { team: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.personnel.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  create(dto: CreatePersonnelDto) {
    return this.prisma.personnel.create({
      data: {
        code: dto.code,
        name: dto.name,
        phone: dto.phone,
        position: dto.position,
        teams: {
          create: dto.teamIds?.map((teamId) => ({ teamId })) ?? [],
        },
      },
      include: { teams: { include: { team: true } } },
    });
  }

  async update(id: string, dto: UpdatePersonnelDto) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.teamIds) {
        await tx.personnelTeam.deleteMany({ where: { personnelId: id } });
        await tx.personnelTeam.createMany({
          data: dto.teamIds.map((teamId) => ({ personnelId: id, teamId })),
          skipDuplicates: true,
        });
      }

      return tx.personnel.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          phone: dto.phone,
          position: dto.position,
        },
        include: { teams: { include: { team: true } } },
      });
    });
  }

  async remove(id: string) {
    await this.prisma.personnel.delete({ where: { id } });
    return { id };
  }
}
