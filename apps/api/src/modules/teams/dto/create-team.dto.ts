import { IsOptional, IsString } from 'class-validator';

export class CreateTeamDto {
  @IsString()
  code!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
