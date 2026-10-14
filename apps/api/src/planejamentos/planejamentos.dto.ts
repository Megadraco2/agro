import { Type } from 'class-transformer';
import {
  IsArray,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
  ValidateNested,
} from 'class-validator';

// Bem acima de qualquer dose agrícola real (fertilizantes raramente
// passam de algumas centenas de kg/ha) — pega input absurdo cedo. O
// estouro do custoEstimado calculado (dose × área × preço) é validado
// à parte, em apps/api/src/common/limite-custo.ts.
const DOSE_POR_HA_MAXIMA = 10_000;

export class PlanejamentoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
  @Max(DOSE_POR_HA_MAXIMA)
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
