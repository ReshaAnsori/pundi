import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  platform: string; // 'meta' | 'tiktok'

  @IsInt()
  @Min(10000)
  dailyBudget: number; // rupiah

  @IsInt()
  @IsOptional()
  @Min(10000)
  totalBudget?: number;

  @IsInt()
  @IsOptional()
  productId?: number;

  @IsInt()
  @IsOptional()
  linkId?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class UpsertBudgetRuleDto {
  @IsString()
  @IsNotEmpty()
  platform: string; // 'all' | 'meta' | 'tiktok'

  @IsInt()
  @Min(0)
  maxDailySpend: number;

  @IsInt()
  @Min(0)
  maxMonthlySpend: number;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}

export class RecordSpendDto {
  @IsInt()
  @Min(0)
  spend: number;

  @IsBoolean()
  @IsOptional()
  replace?: boolean;
}
