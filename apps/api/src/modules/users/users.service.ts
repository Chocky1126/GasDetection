import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.UserWhereInput = query.keyword
      ? {
          OR: [
            { username: { contains: query.keyword, mode: 'insensitive' } },
            { name: { contains: query.keyword, mode: 'insensitive' } },
            { phone: { contains: query.keyword, mode: 'insensitive' } },
            { email: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        ...pagination(query),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          email: true,
          isEnabled: true,
          createdAt: true,
          roles: {
            select: {
              role: {
                select: { id: true, name: true, description: true },
              },
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  async create(dto: CreateUserDto, userId?: string) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          username: dto.username,
          passwordHash,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          isEnabled: dto.isEnabled ?? true,
          roles: {
            create: dto.roleIds?.map((roleId) => ({ roleId })) ?? [],
          },
        },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          email: true,
          isEnabled: true,
          roles: { select: { role: { select: { id: true, name: true, description: true } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'users',
          action: 'CREATE',
          resourceId: user.id,
          detail: `新增用户 ${user.username} ${user.name}`,
        },
      });
      return user;
    });
  }

  async update(id: string, dto: UpdateUserDto, userId?: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds !== undefined) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        if (dto.roleIds.length > 0) {
          await tx.userRole.createMany({
            data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
            skipDuplicates: true,
          });
        }
      }

      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          passwordHash,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          isEnabled: dto.isEnabled,
        },
        select: {
          id: true,
          username: true,
          name: true,
          phone: true,
          email: true,
          isEnabled: true,
          roles: { select: { role: { select: { id: true, name: true, description: true } } } },
        },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'users',
          action: 'UPDATE',
          resourceId: updatedUser.id,
          detail: `更新用户 ${updatedUser.username} ${updatedUser.name}`,
        },
      });
      return updatedUser;
    });
  }

  async remove(id: string, userId?: string) {
    if (id === userId) {
      throw new BadRequestException('不能删除当前登录用户');
    }

    return this.prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.auditLog.updateMany({ where: { userId: id }, data: { userId: null } }),
        tx.alarmActionLog.updateMany({ where: { userId: id }, data: { userId: null } }),
      ]);
      const deletedUser = await tx.user.delete({
        where: { id },
        select: { id: true, username: true, name: true },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'users',
          action: 'DELETE',
          resourceId: deletedUser.id,
          detail: `删除用户 ${deletedUser.username} ${deletedUser.name}`,
        },
      });
      return { id: deletedUser.id };
    });
  }
}
