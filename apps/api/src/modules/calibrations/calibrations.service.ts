import { Injectable } from '@nestjs/common';
import { ListQueryDto, paginated, pagination } from '../../common/dto/list-query.dto';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCalibrationDto } from './dto/create-calibration.dto';

@Injectable()
export class CalibrationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: ListQueryDto) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.calibrationRecord.findMany({
        ...pagination(query),
        include: { device: true },
        orderBy: { calibratedAt: 'desc' },
      }),
      this.prisma.calibrationRecord.count(),
    ]);
    return paginated(items, total, query);
  }

  create(dto: CreateCalibrationDto) {
    return this.prisma.calibrationRecord.create({
      data: {
        ...dto,
        calibratedAt: new Date(dto.calibratedAt),
      },
      include: { device: true },
    });
  }
}
