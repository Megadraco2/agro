import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsPositive,
  IsString,
  Max,
} from 'class-validator';

// Bem acima de qualquer quantidade real comprada de uma vez — pega input
// absurdo cedo. O estouro do custoTotal calculado é validado à parte, em
// apps/api/src/common/limite-custo.ts.
const QUANTIDADE_MAXIMA = 10_000_000;

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
  @Max(QUANTIDADE_MAXIMA)
  quantidade!: number;
}
