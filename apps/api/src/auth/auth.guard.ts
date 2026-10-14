import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessaoId = request.cookies?.['agro_session'] as string | undefined;
    if (!sessaoId) {
      throw new UnauthorizedException('Sessão não encontrada');
    }

    const sessao = await this.prisma.sessaoUsuario.findFirst({
      where: { id: sessaoId, revogadaEm: null, expiraEm: { gt: new Date() } },
      include: { usuario: true },
    });
    if (!sessao) {
      throw new UnauthorizedException('Sessão inválida ou expirada');
    }

    await this.prisma.sessaoUsuario.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS) },
    });

    request.auth = {
      usuarioId: sessao.usuario.id,
      organizacaoId: sessao.usuario.organizacaoId,
      papel: sessao.usuario.papel,
    };
    return true;
  }
}
