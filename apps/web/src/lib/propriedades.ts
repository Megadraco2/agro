import { httpUrlSchema } from '@agro/validation';
import {
  propriedadeResponseSchema,
  type PropriedadeResponse,
} from '@agro/contracts';
import { z } from 'zod';

export async function listarPropriedades(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/propriedades', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar propriedades');
  return z.array(propriedadeResponseSchema).parse(await response.json());
}

export async function criarPropriedade(
  baseUrl: string | undefined,
  dados: { nome: string; areaHa: number },
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/propriedades', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar a propriedade');
  }
  return propriedadeResponseSchema.parse(await response.json());
}

export async function editarPropriedade(
  baseUrl: string | undefined,
  id: string,
  dados: { nome: string; areaHa: number },
  fetcher: typeof fetch = fetch,
): Promise<PropriedadeResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/propriedades/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar a propriedade');
  }
  return propriedadeResponseSchema.parse(await response.json());
}

export async function apagarPropriedade(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/propriedades/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar a propriedade');
  }
}
