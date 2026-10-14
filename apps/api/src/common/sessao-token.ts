import { randomBytes, createHash } from 'node:crypto';

/**
 * Gera um token de sessão aleatório (256 bits) e o hash SHA-256 dele. O token
 * cru vai SOMENTE no cookie do navegador; o banco guarda apenas o hash, de
 * modo que acesso de leitura ao banco não basta pra sequestrar uma sessão.
 */
export function gerarTokenSessao(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashTokenSessao(token);
  return { token, tokenHash };
}

export function hashTokenSessao(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
