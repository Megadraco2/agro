import { httpUrlSchema } from '@agro/validation';
import { insumoResponseSchema, type InsumoResponse } from '@agro/contracts';
import { z } from 'zod';

export async function listarInsumos(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/insumos', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar insumos');
  return z.array(insumoResponseSchema).parse(await response.json());
}

export async function criarInsumo(
  baseUrl: string | undefined,
  dados: { nome: string; unidade: string; precoUnitarioAtual: number },
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/insumos', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o insumo');
  }
  return insumoResponseSchema.parse(await response.json());
}

export async function editarPrecoInsumo(
  baseUrl: string | undefined,
  id: string,
  dados: { precoUnitarioAtual: number },
  fetcher: typeof fetch = fetch,
): Promise<InsumoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/insumos/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar o preço');
  }
  return insumoResponseSchema.parse(await response.json());
}

export async function apagarInsumo(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/insumos/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar o insumo');
  }
}
