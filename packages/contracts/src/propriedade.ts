import { z } from 'zod';

export const propriedadeResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    areaHa: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type PropriedadeResponse = z.infer<typeof propriedadeResponseSchema>;
