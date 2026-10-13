import { expect, it } from 'vitest';
import { healthResponseSchema } from './src';
it('accepts only the public health contract', () => {
  expect(healthResponseSchema.parse({ status: 'ok' })).toEqual({
    status: 'ok',
  });
  for (const value of [
    { status: 'down' },
    {},
    { status: 'ok', secret: 'no' },
  ]) {
    expect(healthResponseSchema.safeParse(value).success).toBe(false);
  }
});
