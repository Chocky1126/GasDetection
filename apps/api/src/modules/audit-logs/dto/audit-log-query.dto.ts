import { IsOptional, IsString } from 'class-validator';
import { ListQueryDto } from '../../../common/dto/list-query.dto';

export class AuditLogQueryDto extends ListQueryDto {
  @IsOptional()
  @IsString()
  module?: string;

  @IsOptional()
  @IsString()
  action?: string;
}
