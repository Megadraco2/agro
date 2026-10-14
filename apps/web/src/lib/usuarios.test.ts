import { describe, expect, it, vi } from 'vitest';
import { criarUsuario, listarUsuarios } from './usuarios';

const usuario = {
  id: '1',
  email: 'a@a.com',
  papel: 'ORG_MEMBER',
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarUsuarios', () => {
  it('lists users with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [usuario] });
    const resultado = await listarUsuarios('http://localhost:3001', fetcher);
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/usuarios'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([usuario]);
  });
});

describe('criarUsuario', () => {
  it('posts the new user and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => usuario });
    const resultado = await criarUsuario(
      'http://localhost:3001',
      { email: 'a@a.com', senha: 'senha123' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/usuarios'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(usuario);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Limite de vagas excedido' }),
    });
    await expect(
      criarUsuario(
        'http://localhost:3001',
        { email: 'a@a.com', senha: 'senha123' },
        fetcher,
      ),
    ).rejects.toThrow('Limite de vagas excedido');
  });
});
