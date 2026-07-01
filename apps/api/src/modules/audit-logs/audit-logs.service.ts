import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: AuditLogQueryDto) {
    const where = this.whereForQuery(query);
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        ...pagination(query),
        include: { user: { select: { id: true, username: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    return paginated(items, total, query);
  }

  private whereForQuery(query: AuditLogQueryDto): Prisma.AuditLogWhereInput {
    return {
      module: query.module,
      action: query.action,
      OR: query.keyword
        ? [
            { detail: { contains: query.keyword, mode: 'insensitive' } },
            { module: { contains: query.keyword, mode: 'insensitive' } },
            { action: { contains: query.keyword, mode: 'insensitive' } },
            { user: { username: { contains: query.keyword, mode: 'insensitive' } } },
            { user: { name: { contains: query.keyword, mode: 'insensitive' } } },
          ]
        : undefined,
    };
  }
}
