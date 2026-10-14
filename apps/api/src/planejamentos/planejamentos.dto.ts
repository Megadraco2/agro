import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PlanejamentoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
  dosePorHa!: number;
}

export class CreatePlanejamentoDto {
  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  procedimentoId!: string;

  @IsISO8601()
  dataPrevista!: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PlanejamentoInsumoDto)
  insumos!: PlanejamentoInsumoDto[];
}
