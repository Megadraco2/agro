import { describe, expect, it, vi } from 'vitest';
import {
  apagarProcedimento,
  criarProcedimento,
  editarProcedimento,
  listarProcedimentos,
} from './procedimentos';

const procedimento = {
  id: '1',
  nome: 'Aplicação de herbicida',
  tipo: 'APLICACAO',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarProcedimentos', () => {
  it('lists procedures with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [procedimento] });
    const resultado = await listarProcedimentos(
      'http://localhost:3001',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([procedimento]);
  });
});

describe('criarProcedimento', () => {
  it('posts the new procedure and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => procedimento });
    const resultado = await criarProcedimento(
      'http://localhost:3001',
      { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(procedimento);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'nome é obrigatório' }),
    });
    await expect(
      criarProcedimento(
        'http://localhost:3001',
        { nome: '', tipo: 'APLICACAO' },
        fetcher,
      ),
    ).rejects.toThrow('nome é obrigatório');
  });
});

describe('editarProcedimento', () => {
  it('patches the procedure and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => procedimento });
    const resultado = await editarProcedimento(
      'http://localhost:3001',
      '1',
      { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos/1'),
      expect.objectContaining({ credentials: 'include', method: 'PATCH' }),
    );
    expect(resultado).toEqual(procedimento);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Procedimento não encontrado' }),
    });
    await expect(
      editarProcedimento(
        'http://localhost:3001',
        '1',
        { nome: 'Aplicação de herbicida', tipo: 'APLICACAO' },
        fetcher,
      ),
    ).rejects.toThrow('Procedimento não encontrado');
  });
});

describe('apagarProcedimento', () => {
  it('deletes the procedure with credentials:"include"', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await apagarProcedimento('http://localhost:3001', '1', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/procedimentos/1'),
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
      apagarProcedimento('http://localhost:3001', '1', fetcher),
    ).rejects.toThrow('já existe histórico vinculado');
  });
});
