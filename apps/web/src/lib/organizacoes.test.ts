import { describe, expect, it, vi } from 'vitest';
import { criarOrganizacao, listarOrganizacoes } from './organizacoes';

const organizacao = {
  id: '1',
  nome: 'Fazenda Boa Vista',
  maxUsuarios: 5,
  totalUsuarios: 1,
  createdAt: '2026-01-01T00:00:00.000Z',
};

describe('listarOrganizacoes', () => {
  it('lists organizations with credentials:"include" and resolves with the parsed body', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => [organizacao] });
    const resultado = await listarOrganizacoes(
      'http://localhost:3001',
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/admin/organizacoes'),
      expect.objectContaining({ credentials: 'include', cache: 'no-store' }),
    );
    expect(resultado).toEqual([organizacao]);
  });
});

describe('criarOrganizacao', () => {
  it('posts the new organization and resolves with the parsed body on success', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => organizacao });
    const resultado = await criarOrganizacao(
      'http://localhost:3001',
      {
        nome: 'Fazenda Boa Vista',
        maxUsuarios: 5,
        adminEmail: 'admin@fazenda.com',
        adminSenha: 'senha123',
      },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/admin/organizacoes'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
    expect(resultado).toEqual(organizacao);
  });

  it('throws with the body message on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ message: 'Papel inválido para esta operação' }),
    });
    await expect(
      criarOrganizacao(
        'http://localhost:3001',
        {
          nome: 'Fazenda Boa Vista',
          maxUsuarios: 5,
          adminEmail: 'admin@fazenda.com',
          adminSenha: 'senha123',
        },
        fetcher,
      ),
    ).rejects.toThrow('Papel inválido para esta operação');
  });
});
