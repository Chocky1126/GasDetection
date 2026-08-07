import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from './users.service';

describe('UsersService', () => {
  function transactionMock(tx: Record<string, any>) {
    return jest.fn(async (input: any) => (Array.isArray(input) ? Promise.all(input) : input(tx)));
  }

  it('returns a keyword-filtered paginated user list', async () => {
    const user = { id: 'user-1', username: 'operator', name: '调度员', roles: [] };
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([user]),
        count: jest.fn().mockResolvedValue(1),
      },
      $transaction: transactionMock({}),
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await expect((service as any).findAll({ keyword: '调度', page: 2, pageSize: 10 })).resolves.toEqual({
      items: [user],
      total: 1,
      page: 2,
      pageSize: 10,
    });
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { username: { contains: '调度', mode: 'insensitive' } },
            { name: { contains: '调度', mode: 'insensitive' } },
            { phone: { contains: '调度', mode: 'insensitive' } },
            { email: { contains: '调度', mode: 'insensitive' } },
          ],
        },
        skip: 10,
        take: 10,
      }),
    );
  });

  it('creates a user and an actor-aware audit log in one transaction', async () => {
    const user = { id: 'user-2', username: 'dispatcher', name: '调度员', isEnabled: true, roles: [] };
    const tx = {
      user: { create: jest.fn().mockResolvedValue(user) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: tx.user.create,
      },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await (service as any).create(
      { username: 'dispatcher', password: 'secret123', name: '调度员', roleIds: ['role-1'] },
      'admin-1',
    );

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'users',
        action: 'CREATE',
        resourceId: 'user-2',
        detail: '新增用户 dispatcher 调度员',
      },
    });
  });

  it('clears roles without issuing an empty createMany and audits the update', async () => {
    const user = { id: 'user-2', username: 'dispatcher', name: '调度员', isEnabled: true, roles: [] };
    const tx = {
      userRole: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn(),
      },
      user: { update: jest.fn().mockResolvedValue(user) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      user: { findUnique: jest.fn().mockResolvedValue(user) },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await (service as any).update('user-2', { roleIds: [] }, 'admin-1');

    expect(tx.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-2' } });
    expect(tx.userRole.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'users',
        action: 'UPDATE',
        resourceId: 'user-2',
        detail: '更新用户 dispatcher 调度员',
      },
    });
  });

  it('rejects deleting the currently authenticated user', async () => {
    const prisma = {
      user: { delete: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await expect((service as any).remove('user-1', 'user-1')).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.delete).not.toHaveBeenCalled();
  });

  it('deletes another user and records the deleted identity', async () => {
    const user = { id: 'user-2', username: 'dispatcher', name: '调度员' };
    const tx = {
      user: { delete: jest.fn().mockResolvedValue(user) },
      alarmActionLog: { updateMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditLog: {
        updateMany: jest.fn().mockResolvedValue({ count: 3 }),
        create: jest.fn().mockResolvedValue({ id: 'audit-1' }),
      },
    };
    const prisma = {
      user: { delete: tx.user.delete },
      $transaction: transactionMock(tx),
    } as unknown as PrismaService;
    const service = new UsersService(prisma);

    await expect((service as any).remove('user-2', 'admin-1')).resolves.toEqual({ id: 'user-2' });
    expect(tx.auditLog.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-2' }, data: { userId: null } });
    expect(tx.alarmActionLog.updateMany).toHaveBeenCalledWith({ where: { userId: 'user-2' }, data: { userId: null } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'admin-1',
        module: 'users',
        action: 'DELETE',
        resourceId: 'user-2',
        detail: '删除用户 dispatcher 调度员',
      },
    });
  });
});
