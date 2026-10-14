import { z } from 'zod';

export const organizacaoAdminResponseSchema = z
  .object({
    id: z.string(),
    nome: z.string(),
    maxUsuarios: z.number().int(),
    totalUsuarios: z.number().int(),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type OrganizacaoAdminResponse = z.infer<
  typeof organizacaoAdminResponseSchema
>;
