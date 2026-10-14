import { z } from 'zod';

export const tipoProcedimentoSchema = z.enum([
  'APLICACAO',
  'PLANTIO',
  'COLHEITA',
  'IRRIGACAO',
  'OUTRO',
]);

export const procedimentoResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    tipo: tipoProcedimentoSchema,
    createdAt: z.iso.datetime(),
  })
  .strict();

export type TipoProcedimento = z.infer<typeof tipoProcedimentoSchema>;
export type ProcedimentoResponse = z.infer<typeof procedimentoResponseSchema>;
