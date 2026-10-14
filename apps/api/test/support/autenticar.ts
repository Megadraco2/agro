import type { PrismaService } from '../../src/prisma/prisma.service';
import { hashSenha } from '../../src/common/senha';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Cria um Usuario ORG_ADMIN na organização "default" (recriada por
 * limparBanco() a cada teste) e uma SessaoUsuario válida direto via Prisma
 * — não passa pela rota HTTP de login porque aqui o que está sendo testado
 * é o domínio agrícola, não autenticação em si (essa tem seus próprios
 * testes em auth.test.ts/usuarios.test.ts). Retorna o header Cookie pronto
 * pra usar em `.set('Cookie', cookie)`.
 */
export async function autenticarComoOrgAdmin(
  prisma: PrismaService,
): Promise<string> {
  const organizacao = await prisma.organizacao.findUniqueOrThrow({
    where: { slug: 'default' },
  });
  const usuario = await prisma.usuario.create({
    data: {
      organizacaoId: organizacao.id,
      email: `teste-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@agro.test`,
      senhaHash: await hashSenha('senha-de-teste-123'),
      papel: 'ORG_ADMIN',
    },
  });
  const sessao = await prisma.sessaoUsuario.create({
    data: {
      usuarioId: usuario.id,
      expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
    },
  });
  return `agro_session=${sessao.id}`;
}
