import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

// Mesmo teto de Propriedade — um talhão nunca deveria ser maior que a
// propriedade que o contém, mas isso não é validado aqui (cross-field).
const AREA_HA_MAXIMA = 1_000_000;

export class CreateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  @Max(AREA_HA_MAXIMA)
  areaHa!: number;
}

export class UpdateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  @Max(AREA_HA_MAXIMA)
  areaHa!: number;
}
