import { z } from 'zod';
export const healthResponseSchema = z
  .object({ status: z.literal('ok') })
  .strict();
export type HealthResponse = z.infer<typeof healthResponseSchema>;
export * from './propriedade';
export * from './talhao';
export * from './safra';
export * from './procedimento';
export * from './insumo';
export * from './planejamento';
export * from './execucao';
export * from './compra-insumo';
