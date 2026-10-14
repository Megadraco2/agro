import { z } from 'zod';

export const insumoResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    unidade: z.string(),
    precoUnitarioAtual: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type InsumoResponse = z.infer<typeof insumoResponseSchema>;
