import { z } from 'zod';

const bootstrapEnvSchema = z.object({
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(8).optional(),
});

export interface AdminBootstrapEnv {
  email?: string;
  senha?: string;
}

export function readAdminBootstrapEnv(
  input: Record<string, string | undefined>,
): AdminBootstrapEnv {
  const result = bootstrapEnvSchema.safeParse(input);
  if (!result.success) {
    throw new Error(
      'ADMIN_BOOTSTRAP_EMAIL/ADMIN_BOOTSTRAP_PASSWORD inválidos: ' +
        result.error.issues.map((issue) => issue.path.join('.')).join(', '),
    );
  }
  return {
    email: result.data.ADMIN_BOOTSTRAP_EMAIL,
    senha: result.data.ADMIN_BOOTSTRAP_PASSWORD,
  };
}
