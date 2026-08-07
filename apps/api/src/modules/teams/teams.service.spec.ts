import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from './teams.service';

describe('TeamsService', () => {
  function setup() {
    const tx = {
      team: {
        create: jest.fn().mockResolvedValue({ id: 'team-1', code: 'T001', name: '甲班' }),
        update: jest.fn().mockResolvedValue({ id: 'team-1', code: 'T001', name: '甲班' }),
        delete: jest.fn().mockResolvedValue({ id: 'team-1', code: 'T001', name: '甲班' }),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      team: tx.team,
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    return { service: new TeamsService(prisma), tx };
  }

  it('creates a team and its audit log in one transaction', async () => {
    const { service, tx } = setup();

    await service.create({ code: 'T001', name: '甲班', description: '早班' }, 'user-1');

    expect(tx.team.create).toHaveBeenCalledWith({ data: { code: 'T001', name: '甲班', description: '早班' } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'teams',
        action: 'CREATE',
        resourceId: 'team-1',
        detail: '新增班组 T001 甲班',
      },
    });
  });

  it('updates a team and records the resulting identity', async () => {
    const { service, tx } = setup();

    await service.update('team-1', { name: '甲班' }, 'user-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'teams',
        action: 'UPDATE',
        resourceId: 'team-1',
        detail: '更新班组 T001 甲班',
      },
    });
  });

  it('deletes a team and records the deleted identity', async () => {
    const { service, tx } = setup();

    await expect(service.remove('team-1', 'user-1')).resolves.toEqual({ id: 'team-1' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'teams',
        action: 'DELETE',
        resourceId: 'team-1',
        detail: '删除班组 T001 甲班',
      },
    });
  });
});
