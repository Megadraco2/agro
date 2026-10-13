import { z } from 'zod';
export const httpUrlSchema = z
  .url()
  .refine(
    (value) => ['http:', 'https:'].includes(new URL(value).protocol),
    'Use an HTTP(S) URL',
  );
export const originSchema = httpUrlSchema.refine(
  (value) => new URL(value).origin === value,
  'Use an origin without a path or trailing slash',
);
