import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class QueryCommissionsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  platformId?: number;

  @IsOptional()
  @IsString()
  @IsIn(['pending', 'valid', 'cancelled'])
  status?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  linkId?: number;

  @IsOptional()
  @IsString()
  subId?: string;
}
