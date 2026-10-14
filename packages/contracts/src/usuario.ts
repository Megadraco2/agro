import { z } from 'zod';

export const usuarioResponseSchema = z
  .object({
    id: z.string(),
    email: z.email(),
    papel: z.enum(['ORG_ADMIN', 'ORG_MEMBER']),
    createdAt: z.iso.datetime(),
  })
  .strict();

export type UsuarioResponse = z.infer<typeof usuarioResponseSchema>;
