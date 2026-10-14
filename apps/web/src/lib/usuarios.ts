import { httpUrlSchema } from '@agro/validation';
import { usuarioResponseSchema, type UsuarioResponse } from '@agro/contracts';
import { z } from 'zod';

export async function listarUsuarios(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<UsuarioResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/usuarios', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar usuários');
  return z.array(usuarioResponseSchema).parse(await response.json());
}

export async function criarUsuario(
  baseUrl: string | undefined,
  dados: { email: string; senha: string },
  fetcher: typeof fetch = fetch,
): Promise<UsuarioResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/usuarios', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o usuário');
  }
  return usuarioResponseSchema.parse(await response.json());
}
