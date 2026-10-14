import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

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
  precoUnitarioAtual!: number;
}

export class UpdateInsumoPrecoDto {
  @IsNumber()
  @IsPositive()
  precoUnitarioAtual!: number;
}
