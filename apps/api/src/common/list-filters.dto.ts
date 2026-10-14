import { IsISO8601, IsOptional, IsString } from 'class-validator';

export class ListFiltersDto {
  @IsOptional()
  @IsString()
  safraId?: string;

  @IsOptional()
  @IsString()
  talhaoId?: string;

  @IsOptional()
  @IsISO8601()
  de?: string;

  @IsOptional()
  @IsISO8601()
  ate?: string;
}
