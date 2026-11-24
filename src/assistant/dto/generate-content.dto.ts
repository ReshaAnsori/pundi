import { IsIn, IsInt, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GenerateContentDto {
  @IsInt()
  @IsNotEmpty()
  productId: number;

  @IsString()
  @IsOptional()
  channel?: string;

  @IsString()
  @IsOptional()
  @IsIn(['problem_solution', 'unboxing', 'comparison', 'storytelling', 'recommendation'])
  angle?: 'problem_solution' | 'unboxing' | 'comparison' | 'storytelling' | 'recommendation';

  @IsString()
  @IsOptional()
  targetAudience?: string;
}
