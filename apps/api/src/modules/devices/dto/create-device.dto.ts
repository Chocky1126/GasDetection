import { DeviceStatus } from '@prisma/client';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateDeviceDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  model!: string;

  @IsString()
  serialNumber!: string;

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
