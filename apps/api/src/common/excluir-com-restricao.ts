import { BadRequestException } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';

const MENSAGEM_PADRAO =
  'Não é possível excluir — já existe histórico vinculado a este registro.';

/**
 * Executa um delete do Prisma e traduz a violação de FK (ON DELETE
 * RESTRICT, já existente desde docs/BACKLOG.md #6) em 400, em vez de
 * deixar o Postgres estourar sozinho (500). Qualquer outro erro é
 * repassado sem alteração.
 */
export async function excluirComRestricao(
  deleteFn: () => Promise<unknown>,
): Promise<void> {
  try {
    await deleteFn();
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003'
    ) {
      throw new BadRequestException(MENSAGEM_PADRAO);
    }
    throw error;
  }
}
