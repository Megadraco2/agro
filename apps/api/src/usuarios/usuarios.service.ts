import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { UsuarioResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { CurrentUserService } from '../auth/current-user.service';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateUsuarioDto } from './usuarios.dto';

type UsuarioRow = {
  id: string;
  email: string;
  papel: 'ORG_ADMIN' | 'ORG_MEMBER';
  createdAt: Date;
};

@Injectable()
export class UsuariosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentUser: CurrentUserService,
  ) {}

  private toResponse(usuario: UsuarioRow): UsuarioResponse {
    return {
      id: usuario.id,
      email: usuario.email,
      papel: usuario.papel,
      createdAt: usuario.createdAt.toISOString(),
    };
  }

  async list(): Promise<UsuarioResponse[]> {
    const { organizacaoId } = this.currentUser.get();
    const usuarios = await this.prisma.usuario.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return usuarios.map((u) => this.toResponse(u));
  }

  async create(dto: CreateUsuarioDto): Promise<UsuarioResponse> {
    const { organizacaoId, papel } = this.currentUser.get();
    if (papel !== 'ORG_ADMIN') {
      throw new ForbiddenException(
        'Só um usuário administrador da organização pode criar outros usuários',
      );
    }

    const organizacao = await this.prisma.organizacao.findUniqueOrThrow({
      where: { id: organizacaoId },
    });
    const totalAtual = await this.prisma.usuario.count({
      where: { organizacaoId },
    });
    if (totalAtual >= organizacao.maxUsuarios) {
      throw new BadRequestException(
        `Limite de ${organizacao.maxUsuarios} usuários da organização já foi atingido`,
      );
    }

    try {
      const usuario = await this.prisma.usuario.create({
        data: {
          organizacaoId,
          email: dto.email,
          senhaHash: await hashSenha(dto.senha),
          papel: dto.papel ?? 'ORG_MEMBER',
        },
      });
      return this.toResponse(usuario);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException('Já existe um usuário com este email');
      }
      throw error;
    }
  }
}
