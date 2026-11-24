import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateProductStatusDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['new', 'shortlisted', 'used', 'skipped'])
  status: string;

  @IsString()
  @IsOptional()
  notes?: string;
}
