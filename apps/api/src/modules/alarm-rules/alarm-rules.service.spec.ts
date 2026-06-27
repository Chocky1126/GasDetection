import { BadRequestException } from '@nestjs/common';
import { AlarmSeverity, GasType, RuleOperator } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmRulesService } from './alarm-rules.service';

describe('AlarmRulesService', () => {
  it('rejects negative threshold values', async () => {
    const service = new AlarmRulesService({} as PrismaService);

    await expect(
      service.create({
        name: '错误阈值',
        gasType: GasType.CH4,
        operator: RuleOperator.GTE,
        thresholdValue: -1,
        severity: AlarmSeverity.HIGH,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
