import { z } from 'zod';

export const talhaoResponseSchema = z
  .object({
    id: z.string(),
    propriedadeId: z.string(),
    nome: z.string(),
    areaHa: z.string(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type TalhaoResponse = z.infer<typeof talhaoResponseSchema>;
