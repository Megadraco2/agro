import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { expect, it, vi } from 'vitest';

function worker() {
  const handlers: Record<string, (event: unknown) => void> = {};
  const fallback = new Response('offline');
  const fetcher = vi.fn().mockRejectedValue(new Error('offline'));
  const cache = { addAll: vi.fn().mockResolvedValue(undefined) };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    match: vi.fn().mockResolvedValue(fallback),
    keys: vi
      .fn()
      .mockResolvedValue(['agro-static-v0', 'agro-static-v1', 'other-app']),
    delete: vi.fn().mockResolvedValue(true),
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), {
    self: {
      location: { origin: 'https://agro.example' },
      clients: { claim: vi.fn().mockResolvedValue(undefined) },
      addEventListener: (name: string, handler: (event: unknown) => void) => {
        handlers[name] = handler;
      },
    },
    caches,
    fetch: fetcher,
    URL,
    Response,
  });
  return { handlers, fallback, fetcher, caches, cache };
}

it('serves the offline fallback when navigation fails', async () => {
  const { handlers, fallback } = worker();
  let result: Promise<Response> | undefined;
  handlers.fetch?.({
    request: { url: 'https://agro.example/', method: 'GET', mode: 'navigate' },
    respondWith: (response: Promise<Response>) => {
      result = response;
    },
  });
  await expect(result).resolves.toBe(fallback);
});

it('does not intercept API requests or mutations', () => {
  const { handlers, fetcher } = worker();
  const respondWith = vi.fn();
  for (const request of [
    { url: 'https://api.example/health', method: 'GET', mode: 'cors' },
    { url: 'https://agro.example/health', method: 'GET', mode: 'cors' },
    { url: 'https://agro.example/', method: 'POST', mode: 'navigate' },
  ])
    handlers.fetch?.({ request, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
  expect(fetcher).not.toHaveBeenCalled();
});

it('precaches only the fallback and cleans up only its own old caches', async () => {
  const { handlers, caches, cache } = worker();
  let pending: Promise<unknown> | undefined;
  const event = {
    waitUntil: (promise: Promise<unknown>) => {
      pending = promise;
    },
  };
  handlers.install?.(event);
  await pending;
  expect(cache.addAll).toHaveBeenCalledWith(['/offline.html']);
  handlers.activate?.(event);
  await pending;
  expect(caches.delete).toHaveBeenCalledExactlyOnceWith('agro-static-v0');
});
