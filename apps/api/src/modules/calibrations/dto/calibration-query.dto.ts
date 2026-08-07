import { CalibrationResult, GasType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export enum CalibrationDueStatus {
  NORMAL = 'NORMAL',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  FAILED = 'FAILED',
}

export class CalibrationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  deviceId?: string;

  @IsOptional()
  @IsEnum(GasType)
  gasType?: GasType;

  @IsOptional()
  @IsEnum(CalibrationResult)
  result?: CalibrationResult;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  calibratedById?: string;

  @IsOptional()
  @IsEnum(CalibrationDueStatus)
  dueStatus?: CalibrationDueStatus;
}
