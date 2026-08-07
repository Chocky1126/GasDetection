import { PrismaService } from '../prisma/prisma.service';
import { AreasService } from './areas.service';

describe('AreasService', () => {
  function setup() {
    const area = { id: 'area-1', code: 'A001', name: '一采区', riskLevel: 3, lng: 112.1, lat: 37.2 };
    const tx = {
      area: {
        create: jest.fn().mockResolvedValue(area),
        update: jest.fn().mockResolvedValue(area),
        delete: jest.fn().mockResolvedValue(area),
      },
      auditLog: { create: jest.fn().mockResolvedValue({ id: 'audit-1' }) },
    };
    const prisma = {
      area: tx.area,
      $transaction: jest.fn(async (callback) => callback(tx)),
    } as unknown as PrismaService;
    return { service: new AreasService(prisma), tx };
  }

  it('creates an area with its default risk level and audit log in one transaction', async () => {
    const { service, tx } = setup();

    await (service as any).create({ code: 'A001', name: '一采区', lng: 112.1, lat: 37.2 }, 'user-1');

    expect(tx.area.create).toHaveBeenCalledWith({
      data: { code: 'A001', name: '一采区', lng: 112.1, lat: 37.2, riskLevel: 1 },
    });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'areas',
        action: 'CREATE',
        resourceId: 'area-1',
        detail: '新增区域 A001 一采区',
      },
    });
  });

  it('updates an area and records its resulting identity', async () => {
    const { service, tx } = setup();

    await (service as any).update('area-1', { riskLevel: 3 }, 'user-1');

    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'areas',
        action: 'UPDATE',
        resourceId: 'area-1',
        detail: '更新区域 A001 一采区',
      },
    });
  });

  it('deletes an area and records the deleted identity', async () => {
    const { service, tx } = setup();

    await expect((service as any).remove('area-1', 'user-1')).resolves.toEqual({ id: 'area-1' });
    expect(tx.auditLog.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        module: 'areas',
        action: 'DELETE',
        resourceId: 'area-1',
        detail: '删除区域 A001 一采区',
      },
    });
  });
});
