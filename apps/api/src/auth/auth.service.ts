import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarSenha } from '../common/senha';
import { gerarTokenSessao, hashTokenSessao } from '../common/sessao-token';
import { PrismaService } from '../prisma/prisma.service';
import type { LoginDto } from './auth.dto';

const SESSAO_DURACAO_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(dto: LoginDto): Promise<string> {
    const usuario = await this.prisma.usuario.findUnique({
      where: { email: dto.email },
    });
    if (!usuario || !(await verificarSenha(dto.senha, usuario.senhaHash))) {
      throw new UnauthorizedException('Email ou senha inválidos');
    }
    const { token, tokenHash } = gerarTokenSessao();
    await this.prisma.sessaoUsuario.create({
      data: {
        usuarioId: usuario.id,
        tokenHash,
        expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
      },
    });
    // O token cru vai só pro cookie; o banco guarda apenas o hash.
    return token;
  }

  async logout(token: string): Promise<void> {
    await this.prisma.sessaoUsuario.updateMany({
      where: { tokenHash: hashTokenSessao(token), revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
