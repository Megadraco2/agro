import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

// Bem acima de qualquer insumo agrícola real — só pra pegar erro de
// digitação/input absurdo antes de entrar em qualquer cálculo de custo.
const PRECO_UNITARIO_MAXIMO = 1_000_000;

export class CreateInsumoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(40)
  unidade!: string;

  @IsNumber()
  @IsPositive()
  @Max(PRECO_UNITARIO_MAXIMO)
  precoUnitarioAtual!: number;
}

export class UpdateInsumoPrecoDto {
  @IsNumber()
  @IsPositive()
  @Max(PRECO_UNITARIO_MAXIMO)
  precoUnitarioAtual!: number;
}
