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
export class AdminAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessaoId = request.cookies?.['agro_admin_session'] as
      string | undefined;
    if (!sessaoId) {
      throw new UnauthorizedException('Sessão de admin não encontrada');
    }

    const sessao = await this.prisma.sessaoAdminSistema.findFirst({
      where: { id: sessaoId, revogadaEm: null, expiraEm: { gt: new Date() } },
    });
    if (!sessao) {
      throw new UnauthorizedException('Sessão de admin inválida ou expirada');
    }

    await this.prisma.sessaoAdminSistema.update({
      where: { id: sessao.id },
      data: { expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS) },
    });

    (request as Request & { adminId: string }).adminId = sessao.adminId;
    return true;
  }
}
