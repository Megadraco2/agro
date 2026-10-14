import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

/**
 * Bem abaixo da capacidade real da coluna `Decimal(14,2)` usada por
 * custoEstimado/custoTotal (~999.999.999.999,99) — @Max por campo não
 * basta sozinho, porque campos individualmente plausíveis (dose, área,
 * preço) se multiplicam e podem estourar a coluna mesmo assim. Esta
 * checagem valida o RESULTADO calculado antes de persistir, pra dar um
 * 400 claro em vez de deixar o Postgres estourar sozinho (500).
 */
const CUSTO_MAXIMO = new Prisma.Decimal('100000000000.00'); // R$ 100 bilhões

export function validarCustoDentroDoLimite(custo: Prisma.Decimal): void {
  if (custo.greaterThan(CUSTO_MAXIMO)) {
    throw new BadRequestException(
      'Custo calculado excede o limite permitido — confira os valores de dose/quantidade, área e preço informados.',
    );
  }
}
