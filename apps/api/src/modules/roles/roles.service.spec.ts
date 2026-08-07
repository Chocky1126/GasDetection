import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RolesService } from './roles.service';

describe('RolesService', () => {
  function transactionMock(tx: Record<string, any>) {
    return jest.fn(async (input: any) => (Array.isArray(input) ? Promise.all(input) : input(tx)));
  }

  it('returns a keyword-filtered paginated role list', async () => {
    const role = { id: 'role-1', name: 'operator', description: '调度操作员', permissions: [] };
    const prisma = {
      role: {
        findMany: jest.fn().mockResolvedValue([role]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: transactionMock({}),
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect((service as any).findAll({ keyword: '调度', page: 1, pageSize: 20 })).resolves.toEqual({
      items: [role],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    expect(prisma.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { name: { contains: '调度', mode: 'insensitive' } },
            { description: { contains: '调度', mode: 'insensitive' } },
          ],
        },
        skip: 0,
        take: 20,
      }),
    );
  });

  it('lists the permission dictionary in stable module and code order', async () => {
    const permissions = [{ id: 'permission-1', code: 'areas:read', name: '区域管理查看', module: 'areas' }];
    const prisma = {
      permission: { findMany: jest.fn().mockResolvedValue(permissions) },
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect((service as any).listPermissions()).resolves.toEqual(permissions);
    expect(prisma.permission.findMany).toHaveBeenCalledWith({ orderBy: [{ module: 'asc' }, { code: 'asc' }] });
  });

  it('creates a role and its audit log in one transaction', async () => {
    const role = { id: 'role-2', name: 'safety', description: '安全员', permissions: [] };
    const tx = {
      role: { create: jest.fn().mockResolvedValue(role) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(null), create: tx.role.create },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await (service as any).create({ name: 'safety', description: '安全员', permissionIds: ['permission-1'] }, 'admin-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'roles',
        action: 'CREATE',
        resourceId: 'role-2',
        detail: '新增角色 safety',
      },
    });
  });

  it('clears permissions without issuing an empty createMany and audits the update', async () => {
    const existing = { id: 'role-2', name: 'safety', description: '安全员' };
    const role = { ...existing, permissions: [] };
    const tx = {
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn(),
      },
      role: { update: jest.fn().mockResolvedValue(role) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(existing) },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await (service as any).update('role-2', { permissionIds: [] }, 'admin-1');

    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'role-2' } });
    expect(tx.rolePermission.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'roles',
        action: 'UPDATE',
        resourceId: 'role-2',
        detail: '更新角色 safety',
      },
    });
  });

  it('rejects renaming or deleting the built-in admin role', async () => {
    const adminRole = { id: 'role-admin', name: 'admin', description: '系统管理员' };
    const prisma = {
      role: {
        findUnique: jest.fn().mockResolvedValue(adminRole),
        delete: jest.fn().mockResolvedValue(adminRole),
      },
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect((service as any).update('role-admin', { name: 'renamed' }, 'admin-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect((service as any).remove('role-admin', 'admin-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.role.delete).not.toHaveBeenCalled();
  });

  it('deletes a regular role and records the deleted identity', async () => {
    const role = { id: 'role-2', name: 'safety', description: '安全员' };
    const tx = {
      role: { delete: jest.fn().mockResolvedValue(role) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      role: { findUnique: jest.fn().mockResolvedValue(role), delete: tx.role.delete },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new RolesService(prisma);

    await expect((service as any).remove('role-2', 'admin-1')).resolves.toEqual({ id: 'role-2' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'roles',
        action: 'DELETE',
        resourceId: 'role-2',
        detail: '删除角色 safety',
      },
    });
  });
});
