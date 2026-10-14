import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarSenha } from '../common/senha';
import { gerarTokenSessao, hashTokenSessao } from '../common/sessao-token';
import { PrismaService } from '../prisma/prisma.service';
import type { AdminLoginDto } from './admin-sistema.dto';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdminAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: AdminLoginDto): Promise<string> {
    const admin = await this.prisma.adminSistema.findUnique({
      where: { email: dto.email },
    });
    if (!admin || !(await verificarSenha(dto.senha, admin.senhaHash))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }
    const { token, tokenHash } = gerarTokenSessao();
    await this.prisma.sessaoAdminSistema.create({
      data: {
        adminId: admin.id,
        tokenHash,
        expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
      },
    });
    // O token cru vai só pro cookie; o banco guarda apenas o hash.
    return token;
  }

  async logout(token: string): Promise<void> {
    await this.prisma.sessaoAdminSistema.updateMany({
      where: { tokenHash: hashTokenSessao(token), revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
