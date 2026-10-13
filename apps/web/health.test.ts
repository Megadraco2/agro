import { expect, it, vi } from 'vitest';
import { checkHealth } from './src/lib/health';
it('validates the HTTP response and bypasses caches', async () => {
  const mock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response('{"status":"ok"}'));
  await expect(checkHealth('http://localhost:3001', mock)).resolves.toEqual({
    status: 'ok',
  });
  expect(mock.mock.calls[0]?.[1]?.cache).toBe('no-store');
});
it('rejects unavailable API, invalid contract and missing configuration', async () => {
  await expect(checkHealth(undefined)).rejects.toThrow();
  await expect(
    checkHealth(
      'http://localhost',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('', { status: 503 })),
    ),
  ).rejects.toThrow();
  await expect(
    checkHealth(
      'http://localhost',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{"status":"wrong"}')),
    ),
  ).rejects.toThrow();
  await expect(
    checkHealth(
      'http://localhost',
      vi.fn<typeof fetch>().mockRejectedValue(new Error('offline')),
    ),
  ).rejects.toThrow('offline');
});
