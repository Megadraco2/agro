import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { TipoProcedimento } from '../generated/prisma/client';

export class CreateProcedimentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @IsEnum(TipoProcedimento)
  tipo!: TipoProcedimento;
}

export class UpdateProcedimentoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(160)
  nome!: string;

  @IsEnum(TipoProcedimento)
  tipo!: TipoProcedimento;
}
