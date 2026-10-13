import { healthResponseSchema } from '@agro/contracts';
import { httpUrlSchema } from '@agro/validation';
export async function checkHealth(
  baseUrl: string | undefined,
  fetcher: typeof fetch = fetch,
) {
  const url = httpUrlSchema.parse(baseUrl);
  const response = await fetcher(new URL('/health', url), {
    cache: 'no-store',
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error('API indisponível');
  return healthResponseSchema.parse(await response.json());
}
