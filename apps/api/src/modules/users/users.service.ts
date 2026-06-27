import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.user.findMany({
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
    });
  }

  async create(dto: CreateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { username: dto.username } });
    if (existing) {
      throw new ConflictException('用户名已存在');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
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
      select: { id: true, username: true, name: true, isEnabled: true },
    });
  }

  async update(id: string, dto: UpdateUserDto) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    return this.prisma.$transaction(async (tx) => {
      if (dto.roleIds) {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.userRole.createMany({
          data: dto.roleIds.map((roleId) => ({ userId: id, roleId })),
          skipDuplicates: true,
        });
      }

      return tx.user.update({
        where: { id },
        data: {
          username: dto.username,
          passwordHash,
          name: dto.name,
          phone: dto.phone,
          email: dto.email,
          isEnabled: dto.isEnabled,
        },
        select: { id: true, username: true, name: true, isEnabled: true },
      });
    });
  }

  async remove(id: string) {
    await this.prisma.user.delete({ where: { id } });
    return { id };
  }
}
