import { z } from 'zod';

export const compraInsumoResponseSchema = z
  .object({
    id: z.string(),
    talhaoId: z.string(),
    safraId: z.string(),
    insumoId: z.string(),
    data: z.iso.datetime(),
    quantidade: z.string(),
    precoUnitarioSnapshot: z.string(),
    custoTotal: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type CompraInsumoResponse = z.infer<typeof compraInsumoResponseSchema>;
