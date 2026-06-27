import { AlarmSeverity, AlarmStatus, GasType } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class AlarmQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(AlarmStatus)
  status?: AlarmStatus;

  @IsOptional()
  @IsEnum(AlarmSeverity)
  severity?: AlarmSeverity;

  @IsOptional()
  @IsEnum(GasType)
  gasType?: GasType;

  @IsOptional()
  @IsString()
  deviceId?: string;
}
