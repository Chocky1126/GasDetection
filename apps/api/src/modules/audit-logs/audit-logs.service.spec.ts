import { PrismaService } from '../prisma/prisma.service';
import { AuditLogsService } from './audit-logs.service';

describe('AuditLogsService', () => {
  it('filters audit logs by module, action, and keyword', async () => {
    const findMany = jest.fn().mockResolvedValue([{ id: 'audit-1' }]);
    const count = jest.fn().mockResolvedValue(1);
    const transaction = jest.fn().mockImplementation(async (operations) => Promise.all(operations));
    const prisma = {
      auditLog: { findMany, count },
      $transaction: transaction,
    } as unknown as PrismaService;
    const service = new AuditLogsService(prisma);

    const result = await service.findAll({
      page: 2,
      pageSize: 10,
      module: 'alarms',
      action: 'ACK',
      keyword: '巡检',
    } as any);

    const where = {
      module: 'alarms',
      action: 'ACK',
      OR: [
        { detail: { contains: '巡检', mode: 'insensitive' } },
        { module: { contains: '巡检', mode: 'insensitive' } },
        { action: { contains: '巡检', mode: 'insensitive' } },
        { user: { username: { contains: '巡检', mode: 'insensitive' } } },
        { user: { name: { contains: '巡检', mode: 'insensitive' } } },
      ],
    };
    expect(findMany).toHaveBeenCalledWith({
      where,
      skip: 10,
      take: 10,
      include: { user: { select: { id: true, username: true, name: true } } },
      orderBy: { createdAt: 'desc' },
    });
    expect(count).toHaveBeenCalledWith({ where });
    expect(result).toEqual({
      items: [{ id: 'audit-1' }],
      total: 1,
      page: 2,
      pageSize: 10,
    });
  });
});
