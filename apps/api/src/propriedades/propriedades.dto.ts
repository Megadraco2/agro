import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

// Bem acima de qualquer propriedade rural real (as maiores do Brasil
// passam de 100 mil ha) — só pra pegar erro de digitação/input absurdo.
const AREA_HA_MAXIMA = 1_000_000;

export class CreatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  @Max(AREA_HA_MAXIMA)
  areaHa!: number;
}

export class UpdatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  @Max(AREA_HA_MAXIMA)
  areaHa!: number;
}
