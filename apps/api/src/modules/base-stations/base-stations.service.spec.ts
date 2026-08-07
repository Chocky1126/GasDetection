import { PrismaService } from '../prisma/prisma.service';
import { BaseStationsService } from './base-stations.service';

describe('BaseStationsService', () => {
  function setup() {
    const station = {
      id: 'station-1',
      code: 'BS001',
      name: '一号基站',
      areaId: 'area-1',
      lng: 112.1,
      lat: 37.2,
      depth: 320,
      area: { id: 'area-1', name: '一采区' },
    };
    const tx = {
      baseStation: {
        create: jest.fn().mockResolvedValue(station),
        update: jest.fn().mockResolvedValue(station),
        delete: jest.fn().mockResolvedValue(station),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      baseStation: tx.baseStation,
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    return { service: new BaseStationsService(prisma), tx };
  }

  it('creates a base station and an actor-aware audit log in one transaction', async () => {
    const { service, tx } = setup();
    const dto = { code: 'BS001', name: '一号基站', areaId: 'area-1', lng: 112.1, lat: 37.2, depth: 320 };

    await (service as any).create(dto, 'user-1');

    expect(tx.baseStation.create).toHaveBeenCalledWith({ data: dto, include: { area: true } });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'base-stations',
        action: 'CREATE',
        resourceId: 'station-1',
        detail: '新增基站 BS001 一号基站',
      },
    });
  });

  it('updates a base station and records its resulting identity', async () => {
    const { service, tx } = setup();

    await (service as any).update('station-1', { depth: 320 }, 'user-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'base-stations',
        action: 'UPDATE',
        resourceId: 'station-1',
        detail: '更新基站 BS001 一号基站',
      },
    });
  });

  it('deletes a base station and records the deleted identity', async () => {
    const { service, tx } = setup();

    await expect((service as any).remove('station-1', 'user-1')).resolves.toEqual({ id: 'station-1' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'base-stations',
        action: 'DELETE',
        resourceId: 'station-1',
        detail: '删除基站 BS001 一号基站',
      },
    });
  });
});
