import { IsOptional, IsString } from 'class-validator';

export class QueryScheduleDto {
  @IsString()
  @IsOptional()
  status?: string;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  from?: string;

  @IsString()
  @IsOptional()
  to?: string;
}

export class MarkPostedDto {
  @IsString()
  @IsOptional()
  externalUrl?: string;
}
