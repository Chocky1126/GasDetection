import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAlarmRuleDto } from './dto/create-alarm-rule.dto';
import { UpdateAlarmRuleDto } from './dto/update-alarm-rule.dto';

@Injectable()
export class AlarmRulesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.alarmRule.findMany({ orderBy: { createdAt: 'desc' } });
  }

  async create(dto: CreateAlarmRuleDto) {
    this.assertThreshold(dto.thresholdValue);
    return this.prisma.alarmRule.create({
      data: {
        name: dto.name,
        gasType: dto.gasType,
        operator: dto.operator,
        thresholdValue: dto.thresholdValue,
        severity: dto.severity,
        durationSeconds: dto.durationSeconds ?? 0,
        enabled: dto.enabled ?? true,
      },
    });
  }

  async update(id: string, dto: UpdateAlarmRuleDto) {
    if (dto.thresholdValue !== undefined) {
      this.assertThreshold(dto.thresholdValue);
    }
    return this.prisma.alarmRule.update({ where: { id }, data: dto });
  }

  async remove(id: string) {
    await this.prisma.alarmRule.delete({ where: { id } });
    return { id };
  }

  private assertThreshold(value: number) {
    if (value < 0) {
      throw new BadRequestException('报警阈值不能为负数');
    }
  }
}
