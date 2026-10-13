import { z } from 'zod';
import { originSchema } from '@agro/validation';
export const apiEnvSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGIN: originSchema,
  DATABASE_URL: z
    .string()
    .url()
    .refine((value) =>
      ['postgresql:', 'postgres:'].includes(new URL(value).protocol),
    ),
});
export type ApiEnv = z.infer<typeof apiEnvSchema>;
export function readEnv(input: Record<string, string | undefined>): ApiEnv {
  const result = apiEnvSchema.safeParse(input);
  if (!result.success)
    throw new Error(
      'Variáveis inválidas: ' +
        result.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  return result.data;
}
