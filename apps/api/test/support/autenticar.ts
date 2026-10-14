import type { PrismaService } from '../../src/prisma/prisma.service';
import { hashSenha } from '../../src/common/senha';
import { gerarTokenSessao } from '../../src/common/sessao-token';

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
  return criarSessaoUsuario(prisma, usuario.id);
}

/**
 * Cria uma SessaoUsuario válida para um usuário já existente direto via
 * Prisma (mesmo formato que AuthService.login() grava: só o hash do token
 * no banco) e retorna o header Cookie com o token cru. Útil quando o teste
 * precisa de vários usuários autenticados sem gastar o orçamento do rate
 * limit de POST /auth/login (5 requisições/60s por app).
 */
export async function criarSessaoUsuario(
  prisma: PrismaService,
  usuarioId: string,
): Promise<string> {
  const { token, tokenHash } = gerarTokenSessao();
  await prisma.sessaoUsuario.create({
    data: {
      usuarioId,
      tokenHash,
      expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
    },
  });
  return `agro_session=${token}`;
}
