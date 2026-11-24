import { IsOptional, IsString } from 'class-validator';

export class QueryContentDto {
  @IsOptional()
  @IsString()
  channel?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
