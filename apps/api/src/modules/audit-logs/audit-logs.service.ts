import { Injectable } from '@nestjs/common';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditLogsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        ...pagination(query),
        include: { user: { select: { id: true, username: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);
    return paginated(items, total, query);
  }
}
