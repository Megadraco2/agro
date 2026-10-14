import {
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}

export class UpdateTalhaoDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsNumber()
  @IsPositive()
  areaHa!: number;
}
