import { z } from 'zod';

export const planejamentoStatusSchema = z.enum([
  'PLANEJADO',
  'ATRASADO',
  'EXECUTADO',
]);

export const planejamentoInsumoResponseSchema = z
  .object({
    insumoId: z.string(),
    dosePorHa: z.string(),
    precoUnitarioSnapshot: z.string(),
  })
  .strict();

export const planejamentoResponseSchema = z
  .object({
    id: z.string(),
    safraId: z.string(),
    talhaoId: z.string(),
    procedimentoId: z.string(),
    dataPrevista: z.iso.datetime(),
    custoEstimado: z.string(),
    observacao: z.string().nullable(),
    status: planejamentoStatusSchema,
    insumos: z.array(planejamentoInsumoResponseSchema),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type PlanejamentoStatus = z.infer<typeof planejamentoStatusSchema>;
export type PlanejamentoResponse = z.infer<typeof planejamentoResponseSchema>;
