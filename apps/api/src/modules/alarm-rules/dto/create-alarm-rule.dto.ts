import { AlarmSeverity, GasType, RuleOperator } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateAlarmRuleDto {
  @IsString()
  name!: string;

  @IsEnum(GasType)
  gasType!: GasType;

  @IsEnum(RuleOperator)
  operator!: RuleOperator;

  @IsNumber()
  @Min(0)
  thresholdValue!: number;

  @IsEnum(AlarmSeverity)
  severity!: AlarmSeverity;

  @IsOptional()
  @IsInt()
  @Min(0)
  durationSeconds?: number;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
