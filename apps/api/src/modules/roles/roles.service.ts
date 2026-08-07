import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@Injectable()
export class RolesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const where: Prisma.RoleWhereInput = query.keyword
      ? {
          OR: [
            { name: { contains: query.keyword, mode: 'insensitive' } },
            { description: { contains: query.keyword, mode: 'insensitive' } },
          ],
        }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        ...pagination(query),
        orderBy: { createdAt: 'asc' },
        include: {
          permissions: {
            include: {
              permission: true,
            },
          },
        },
      }),
      this.prisma.role.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  }

  async create(dto: CreateRoleDto, userId?: string) {
    const existing = await this.prisma.role.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException('角色名已存在');
    }

    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({
        data: {
          name: dto.name,
          description: dto.description,
          permissions: {
            create: dto.permissionIds?.map((permissionId) => ({ permissionId })) ?? [],
          },
        },
        include: { permissions: { include: { permission: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'roles',
          action: 'CREATE',
          resourceId: role.id,
          detail: `新增角色 ${role.name}`,
        },
      });
      return role;
    });
  }

  async update(id: string, dto: UpdateRoleDto, userId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.name === 'admin' && dto.name && dto.name !== 'admin') {
      throw new BadRequestException('内置管理员角色不能改名');
    }

    return this.prisma.$transaction(async (tx) => {
      if (dto.permissionIds !== undefined) {
        await tx.rolePermission.deleteMany({ where: { roleId: id } });
        if (dto.permissionIds.length > 0) {
          await tx.rolePermission.createMany({
            data: dto.permissionIds.map((permissionId) => ({ roleId: id, permissionId })),
            skipDuplicates: true,
          });
        }
      }

      const updatedRole = await tx.role.update({
        where: { id },
        data: {
          name: dto.name,
          description: dto.description,
        },
        include: { permissions: { include: { permission: true } } },
      });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'roles',
          action: 'UPDATE',
          resourceId: updatedRole.id,
          detail: `更新角色 ${updatedRole.name}`,
        },
      });
      return updatedRole;
    });
  }

  async remove(id: string, userId?: string) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new NotFoundException('角色不存在');
    }
    if (role.name === 'admin') {
      throw new BadRequestException('内置管理员角色不能删除');
    }

    return this.prisma.$transaction(async (tx) => {
      const deletedRole = await tx.role.delete({ where: { id } });
      await tx.auditLog.create({
        data: {
          userId,
          module: 'roles',
          action: 'DELETE',
          resourceId: deletedRole.id,
          detail: `删除角色 ${deletedRole.name}`,
        },
      });
      return { id: deletedRole.id };
    });
  }
}
