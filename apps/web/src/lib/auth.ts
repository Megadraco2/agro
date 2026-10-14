import { httpUrlSchema } from '@agro/validation';

export async function login(
  baseUrl: string | undefined,
  credenciais: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/auth/login', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credenciais),
  });
  if (!response.ok) throw new Error('Email ou senha inválidos');
}
