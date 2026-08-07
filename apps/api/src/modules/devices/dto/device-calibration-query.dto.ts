import { GasType } from '@prisma/client';
import { IsEnum, IsOptional } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class DeviceCalibrationQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(GasType)
  gasType?: GasType;
}
