import { z } from 'zod';
export const healthResponseSchema = z
  .object({ status: z.literal('ok') })
  .strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export * from './propriedade';
export * from './talhao';
export * from './safra';
