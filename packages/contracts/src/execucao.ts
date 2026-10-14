import { z } from 'zod';

export const execucaoInsumoResponseSchema = z
  .object({
    insumoId: z.string(),
    quantidade: z.string(),
    precoUnitarioSnapshot: z.string(),
  })
  .strict();

export const execucaoResponseSchema = z
  .object({
    id: z.string(),
    safraId: z.string(),
    talhaoId: z.string(),
    procedimentoId: z.string(),
    planejamentoItemId: z.string().nullable(),
    data: z.iso.datetime(),
    custoTotal: z.string(),
    operador: z.string().nullable(),
    maquina: z.string().nullable(),
    quantidadeColhidaSacas: z.string().nullable(),
    observacao: z.string().nullable(),
    insumos: z.array(execucaoInsumoResponseSchema),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type ExecucaoResponse = z.infer<typeof execucaoResponseSchema>;
