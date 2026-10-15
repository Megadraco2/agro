import { httpUrlSchema } from '@agro/validation';
import {
  procedimentoResponseSchema,
  type ProcedimentoResponse,
  type TipoProcedimento,
} from '@agro/contracts';
import { z } from 'zod';

export async function listarProcedimentos(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse[]> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/procedimentos', url), {
    credentials: 'include',
    cache: 'no-store',
  });
  if (!response.ok) throw new Error('Não foi possível listar procedimentos');
  return z.array(procedimentoResponseSchema).parse(await response.json());
}

export async function criarProcedimento(
  baseUrl: string | undefined,
  dados: { nome: string; tipo: TipoProcedimento },
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/procedimentos', url), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível criar o procedimento');
  }
  return procedimentoResponseSchema.parse(await response.json());
}

export async function editarProcedimento(
  baseUrl: string | undefined,
  id: string,
  dados: { nome: string; tipo: TipoProcedimento },
  fetcher: typeof fetch = fetch,
): Promise<ProcedimentoResponse> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/procedimentos/${id}`, url), {
    method: 'PATCH',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dados),
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível editar o procedimento');
  }
  return procedimentoResponseSchema.parse(await response.json());
}

export async function apagarProcedimento(
  baseUrl: string | undefined,
  id: string,
  fetcher: typeof fetch = fetch,
): Promise<void> {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL(`/procedimentos/${id}`, url), {
    method: 'DELETE',
    credentials: 'include',
  });
  if (!response.ok) {
    const corpo = await response.json().catch(() => null);
    throw new Error(corpo?.message ?? 'Não foi possível apagar o procedimento');
  }
}
