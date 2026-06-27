import { Type } from 'class-transformer';
import { IsNumber, IsString } from 'class-validator';

export class CreateBaseStationDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsString()
  areaId!: string;

  @Type(() => Number)
  @IsNumber()
  lng!: number;

  @Type(() => Number)
  @IsNumber()
  lat!: number;

  @Type(() => Number)
  @IsNumber()
  depth!: number;
}
