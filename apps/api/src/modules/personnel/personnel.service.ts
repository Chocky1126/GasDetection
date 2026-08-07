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

  create(dto: CreatePersonnelDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const person = await tx.personnel.create({
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
      await tx.auditLog.create({
        data: {
          userId,
          module: 'personnel',
          action: 'CREATE',
          resourceId: person.id,
          detail: `新增人员 ${person.code} ${person.name}`,
        },
      });
      return person;
    });
  }

  async update(id: string, dto: UpdatePersonnelDto, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      if (dto.teamIds !== undefined) {
        await tx.personnelTeam.deleteMany({ where: { personnelId: id } });
        if (dto.teamIds.length > 0) {
          await tx.personnelTeam.createMany({
            data: dto.teamIds.map((teamId) => ({ personnelId: id, teamId })),
            skipDuplicates: true,
          });
        }
      }

      const person = await tx.personnel.update({
        where: { id },
        data: {
          code: dto.code,
          name: dto.name,
          phone: dto.phone,
          position: dto.position,
        },
        include: { teams: { include: { team: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'personnel',
          action: 'UPDATE',
          resourceId: person.id,
          detail: `更新人员 ${person.code} ${person.name}`,
        },
      });
      return person;
    });
  }

  remove(id: string, userId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const person = await tx.personnel.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'personnel',
          action: 'DELETE',
          resourceId: person.id,
          detail: `删除人员 ${person.code} ${person.name}`,
        },
      });
      return { id: person.id };
    });
  }
}
