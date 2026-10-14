import { z } from 'zod';

export const safraResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    cultura: z.string(),
    dataInicio: z.iso.datetime(),
    dataFim: z.iso.datetime(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type SafraResponse = z.infer<typeof safraResponseSchema>;
