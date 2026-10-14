import { httpUrlSchema } from '@agro/validation';

export async function loginAdmin(
  baseUrl: string | undefined,
  credenciais: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/admin/auth/login', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciais),
  });
  if (!response.ok) throw new Error('Email ou senha inválidos');
}
