import { describe, expect, it, vi } from 'vitest';
import {
  apagarPropriedade,
  criarPropriedade,
  editarPropriedade,
  listarPropriedades,
} from './propriedades';

const propriedade = {
  id: '1',
  nome: 'Fazenda Boa Vista',
  areaHa: '120.5000',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarPropriedades', () => {
  it('lists properties with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [propriedade] });
    const resultado = await listarPropriedades(
      'http://localhost:3001',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([propriedade]);
  });
});

describe('criarPropriedade', () => {
  it('posts the new property and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => propriedade });
    const resultado = await criarPropriedade(
      'http://localhost:3001',
      { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(propriedade);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarPropriedade(
        'http://localhost:3001',
        { nome: '', areaHa: 120.5 },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarPropriedade', () => {
  it('patches the property and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => propriedade });
    const resultado = await editarPropriedade(
      'http://localhost:3001',
      '1',
      { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(propriedade);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Propriedade não encontrada' }),
    });
    await expect(
      editarPropriedade(
        'http://localhost:3001',
        '1',
        { nome: 'Fazenda Boa Vista', areaHa: 120.5 },
        fetcher,
      ),
    ).rejects.toThrow('Propriedade não encontrada');
  });
});

describe('apagarPropriedade', () => {
  it('deletes the property with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarPropriedade('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/propriedades/1'),
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
      apagarPropriedade('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
