import { describe, expect, it, vi } from 'vitest';
import { login } from './auth';

describe('login', () => {
  it('posts credentials with credentials:"include" and resolves on success', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true });
    await login(
      'http://localhost:3001',
      { email: 'a@a.com', senha: 'senha123' },
      fetcher,
    );
    expect(fetcher).toHaveBeenCalledWith(
      new URL('http://localhost:3001/auth/login'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }),
    );
  });

  it('throws on failure response', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: false });
    await expect(
      login(
        'http://localhost:3001',
        { email: 'a@a.com', senha: 'errada' },
        fetcher,
      ),
    ).rejects.toThrow('Email ou senha inválidos');
  });
});
