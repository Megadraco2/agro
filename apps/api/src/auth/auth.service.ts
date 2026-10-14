import { Injectable, UnauthorizedException } from '@nestjs/common';
import { verificarSenha } from '../common/senha';
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
    const sessao = await this.prisma.sessaoUsuario.create({
      data: {
        usuarioId: usuario.id,
        expiraEm: new Date(Date.now() + SESSAO_DURACAO_MS),
      },
    });
    return sessao.id;
  }

  async logout(sessaoId: string): Promise<void> {
    await this.prisma.sessaoUsuario.updateMany({
      where: { id: sessaoId, revogadaEm: null },
      data: { revogadaEm: new Date() },
    });
  }
}
