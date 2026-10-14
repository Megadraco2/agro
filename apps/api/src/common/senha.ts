import { hash, compare } from 'bcryptjs';

const SALT_ROUNDS = 12;

export async function hashSenha(senha: string): Promise<string> {
  return hash(senha, SALT_ROUNDS);
}

export async function verificarSenha(
  senha: string,
  senhaHash: string,
): Promise<boolean> {
  return compare(senha, senhaHash);
}
