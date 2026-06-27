import { IsArray, IsOptional, IsString } from 'class-validator';

export class CreatePersonnelDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  position?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  teamIds?: string[];
}
