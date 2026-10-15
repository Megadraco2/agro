import { describe, expect, it, vi } from 'vitest';
import {
  apagarInsumo,
  criarInsumo,
  editarPrecoInsumo,
  listarInsumos,
} from './insumos';

const insumo = {
  id: '1',
  nome: 'Ureia',
  unidade: 'kg',
  precoUnitarioAtual: '2.5000',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarInsumos', () => {
  it('lists inputs with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [insumo] });
    const resultado = await listarInsumos('http://localhost:3001', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([insumo]);
  });
});

describe('criarInsumo', () => {
  it('posts the new input and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => insumo });
    const resultado = await criarInsumo(
      'http://localhost:3001',
      { nome: 'Ureia', unidade: 'kg', precoUnitarioAtual: 2.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(insumo);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarInsumo(
        'http://localhost:3001',
        { nome: '', unidade: 'kg', precoUnitarioAtual: 2.5 },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarPrecoInsumo', () => {
  it('patches only the price and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => insumo });
    const resultado = await editarPrecoInsumo(
      'http://localhost:3001',
      '1',
      { precoUnitarioAtual: 2.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(insumo);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Insumo não encontrado' }),
    });
    await expect(
      editarPrecoInsumo(
        'http://localhost:3001',
        '1',
        { precoUnitarioAtual: 2.5 },
        fetcher,
      ),
    ).rejects.toThrow('Insumo não encontrado');
  });
});

describe('apagarInsumo', () => {
  it('deletes the input with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarInsumo('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/insumos/1'),
      expect.objectContaining({ credentials: 'include', method: 'DELETE' }),
    );
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({
        message:
          'Não é possível excluir — já existe histórico vinculado a este registro.',
      }),
    });
    await expect(
      apagarInsumo('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
