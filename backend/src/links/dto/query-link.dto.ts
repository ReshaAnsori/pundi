import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class QueryLinkDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  contentId?: number;
}
