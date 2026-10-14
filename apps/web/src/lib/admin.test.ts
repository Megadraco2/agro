import { describe, expect, it, vi } from 'vitest';
import { loginAdmin } from './admin';

describe('loginAdmin', () => {
  it('posts credentials with credentials:"include" and resolves on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await loginAdmin(
      'http://localhost:3001',
      { email: 'a@a.com', senha: 'senha123' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/admin/auth/login'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('throws on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    await expect(
      loginAdmin(
        'http://localhost:3001',
        { email: 'a@a.com', senha: 'errada' },
        fetcher,
      ),
    ).rejects.toThrow('Email ou senha inválidos');
  });
});
