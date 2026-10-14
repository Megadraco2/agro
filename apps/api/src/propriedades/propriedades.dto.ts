import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}

export class UpdatePropriedadeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}
