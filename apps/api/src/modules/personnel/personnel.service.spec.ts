import { PrismaService } from '../prisma/prisma.service';
import { PersonnelService } from './personnel.service';

describe('PersonnelService', () => {
  it('creates personnel with teams and an actor-aware audit log in one transaction', async () => {
    const person = { id: 'person-1', code: 'P001', name: '张三', teams: [] };
    const tx = {
      personnel: { create: jest.fn().mockResolvedValue(person) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      personnel: { create: tx.personnel.create },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    const service = new PersonnelService(prisma);

    await expect(
      service.create(
        { code: 'P001', name: '张三', phone: '13800000000', position: '瓦检员', teamIds: ['team-1'] },
        'user-1',
      ),
    ).resolves.toEqual(person);
    expect(tx.personnel.create).toHaveBeenCalledWith({
      data: {
        code: 'P001',
        name: '张三',
        phone: '13800000000',
        position: '瓦检员',
        teams: { create: [{ teamId: 'team-1' }] },
      },
      include: { teams: { include: { team: true } } },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'personnel',
        action: 'CREATE',
        resourceId: 'person-1',
        detail: '新增人员 P001 张三',
      },
    });
  });

  it('clears personnel memberships without issuing an empty createMany and audits the update', async () => {
    const person = { id: 'person-1', code: 'P001', name: '张三', teams: [] };
    const tx = {
      personnelTeam: {
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        createMany: jest.fn(),
      },
      personnel: { update: jest.fn().mockResolvedValue(person) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = { $transaction: jest.fn(async (callback) => callback(tx)) } as unknown as PrismaService;
    const service = new PersonnelService(prisma);

    await expect(service.update('person-1', { name: '张三', teamIds: [] }, 'user-1')).resolves.toEqual(person);
    expect(tx.personnelTeam.deleteMany).toHaveBeenCalledWith({ where: { personnelId: 'person-1' } });
    expect(tx.personnelTeam.createMany).not.toHaveBeenCalled();
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'personnel',
        action: 'UPDATE',
        resourceId: 'person-1',
        detail: '更新人员 P001 张三',
      },
    });
  });

  it('deletes personnel and records the deleted identity in the audit log', async () => {
    const tx = {
      personnel: { delete: jest.fn().mockResolvedValue({ id: 'person-1', code: 'P001', name: '张三' }) },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      personnel: { delete: tx.personnel.delete },
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    const service = new PersonnelService(prisma);

    await expect(service.remove('person-1', 'user-1')).resolves.toEqual({ id: 'person-1' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'personnel',
        action: 'DELETE',
        resourceId: 'person-1',
        detail: '删除人员 P001 张三',
      },
    });
  });
});
