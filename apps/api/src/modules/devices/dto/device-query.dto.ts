import { DeviceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class DeviceQueryDto extends ListQueryDto {
  @IsOptional()
  @IsEnum(DeviceStatus)
  status?: DeviceStatus;

  @IsOptional()
  @IsString()
  areaId?: string;

  @IsOptional()
  @IsString()
  baseStationId?: string;
}
