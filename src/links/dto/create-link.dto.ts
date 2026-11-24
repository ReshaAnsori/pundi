import { IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateLinkDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsInt()
  @IsOptional()
  contentId?: number;

  @IsString()
  @IsOptional()
  customSubId?: string;

  @IsString()
  @IsOptional()
  trackingUrl?: string;
}
