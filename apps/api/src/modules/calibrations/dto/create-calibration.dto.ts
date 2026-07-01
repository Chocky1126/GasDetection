import { GasType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateCalibrationDto {
  @IsString()
  deviceId!: string;

  @IsEnum(GasType)
  gasType!: GasType;

  @Type(() => Number)
  @IsNumber()
  beforeValue!: number;

  @Type(() => Number)
  @IsNumber()
  afterValue!: number;

  @Type(() => Number)
  @IsNumber()
  standardValue!: number;

  @IsOptional()
  @IsString()
  calibratedById?: string;

  @IsOptional()
  @IsString()
  teamId?: string;

  @IsOptional()
  @IsString()
  calibratedBy?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsDateString()
  calibratedAt!: string;
}
