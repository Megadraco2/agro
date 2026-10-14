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

export class ExecucaoInsumoDto {
  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsNumber()
  @IsPositive()
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
