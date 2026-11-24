import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdatePlatformDto {
  @IsString()
  @IsOptional()
  name?: string;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
