import { config } from 'dotenv';
import { resolve } from 'node:path';

// Carrega .env.test (não .env) para que `pnpm test` nunca aponte pro mesmo
// banco que `pnpm dev` usa. Em CI isto é um no-op silencioso — o arquivo não
// existe lá, e as env vars já chegam setadas pelo workflow antes do Jest
// rodar (dotenv nunca sobrescreve valores já presentes em process.env).
config({ path: resolve(__dirname, '..', '.env.test'), quiet: true });
