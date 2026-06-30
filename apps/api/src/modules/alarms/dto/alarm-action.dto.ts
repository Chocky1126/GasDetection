import { IsOptional, IsString, MaxLength } from 'class-validator';

export class AlarmActionDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  remark?: string;
}
