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

// Bem acima de qualquer quantidade real usada numa única execução — pega
// input absurdo cedo. O estouro do custoTotal calculado é validado à
// parte, em apps/api/src/common/limite-custo.ts.
const QUANTIDADE_MAXIMA = 10_000_000;
const SACAS_COLHIDAS_MAXIMAS = 10_000_000;

export class ExecucaoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
  @Max(QUANTIDADE_MAXIMA)
  quantidade!: number;
}

export class CreateExecucaoDto {
  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  procedimentoId!: string;

  @IsOptional()
  @IsString()
  planejamentoItemId?: string;

  @IsISO8601()
  data!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  operador?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  maquina?: string;

  @IsOptional()
  @IsNumber()
  @IsPositive()
  @Max(SACAS_COLHIDAS_MAXIMAS)
  quantidadeColhidaSacas?: number;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  observacao?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ExecucaoInsumoDto)
  insumos!: ExecucaoInsumoDto[];
}
