import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateContentDto {
  @IsString()
  @IsNotEmpty()
  title: string;

  @IsString()
  @IsNotEmpty()
  channel: string;

  @IsString()
  @IsOptional()
  @IsIn(['draft', 'published', 'archived'])
  status?: string;

  @IsString()
  @IsOptional()
  externalUrl?: string;

  @IsDateString()
  @IsOptional()
  publishedAt?: string;

  @IsOptional()
  productionHours?: number;
}
