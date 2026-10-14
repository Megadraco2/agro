import { hashSenha, verificarSenha } from '../src/common/senha';

describe('hash de senha', () => {
  it('verifies a correct password against its hash', async () => {
    const hash = await hashSenha('senha-correta-123');
    await expect(verificarSenha('senha-correta-123', hash)).resolves.toBe(true);
  });

  it('rejects an incorrect password against the hash', async () => {
    const hash = await hashSenha('senha-correta-123');
    await expect(verificarSenha('senha-errada', hash)).resolves.toBe(false);
  });

  it('produces a different hash each time (salt aleatório)', async () => {
    const hash1 = await hashSenha('mesma-senha');
    const hash2 = await hashSenha('mesma-senha');
    expect(hash1).not.toBe(hash2);
  });
});
