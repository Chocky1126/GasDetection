import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  pageSize = 20;

  @IsOptional()
  @IsString()
  keyword?: string;
}

export function pagination(query: ListQueryDto) {
  return {
    skip: (query.page - 1) * query.pageSize,
    take: query.pageSize,
  };
}

export function paginated<T>(items: T[], total: number, query: ListQueryDto) {
  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
  };
}
