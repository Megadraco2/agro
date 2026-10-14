import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
} from 'class-validator';

export class CreateCompraInsumoDto {
  @IsString()
  @IsNotEmpty()
  talhaoId!: string;

  @IsString()
  @IsNotEmpty()
  safraId!: string;

  @IsString()
  @IsNotEmpty()
  insumoId!: string;

  @IsISO8601()
  data!: string;

  @IsNumber()
  @IsPositive()
  quantidade!: number;
}
