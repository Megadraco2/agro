import { httpUrlSchema } from '@agro/validation';
import {
  organizacaoAdminResponseSchema,
  type OrganizacaoAdminResponse,
} from '@agro/contracts';
import { z } from 'zod';

export async function listarOrganizacoes(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<OrganizacaoAdminResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/admin/organizacoes', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar organizações');
  return z.array(organizacaoAdminResponseSchema).parse(await response.json());
}

export async function criarOrganizacao(
  baseUrl: string | undefined,
  dados: {
    nome: string;
    maxUsuarios: number;
    adminEmail: string;
    adminSenha: string;
  },
  fetcher: typeof fetch = fetch,
): Promise<OrganizacaoAdminResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/admin/organizacoes', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar a organização');
  }
  return organizacaoAdminResponseSchema.parse(await response.json());
}
