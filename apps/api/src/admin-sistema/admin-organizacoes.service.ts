import { BadRequestException, Injectable } from '@nestjs/common';
import type { OrganizacaoAdminResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { hashSenha } from '../common/senha';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateOrganizacaoDto } from './admin-sistema.dto';

@Injectable()
export class AdminOrganizacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<OrganizacaoAdminResponse[]> {
    const organizacoes = await this.prisma.organizacao.findMany({
      include: { _count: { select: { usuarios: true } } },
      orderBy: { createdAt: 'asc' },
    });
    return organizacoes.map((o) => ({
      id: o.id,
      nome: o.nome,
      maxUsuarios: o.maxUsuarios,
      totalUsuarios: o._count.usuarios,
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async create(dto: CreateOrganizacaoDto): Promise<OrganizacaoAdminResponse> {
    // Hash fora da transação: bcrypt leva ~100-250ms e não precisa segurar
    // uma transação aberta no banco enquanto calcula.
    const senhaHash = await hashSenha(dto.adminSenha);
    try {
      const resultado = await this.prisma.$transaction(async (tx) => {
        const organizacao = await tx.organizacao.create({
          data: {
            slug: `org-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            nome: dto.nome,
            maxUsuarios: dto.maxUsuarios,
          },
        });
        await tx.usuario.create({
          data: {
            organizacaoId: organizacao.id,
            email: dto.adminEmail,
            senhaHash,
            papel: 'ORG_ADMIN',
          },
        });
        return organizacao;
      });
      return {
        id: resultado.id,
        nome: resultado.nome,
        maxUsuarios: resultado.maxUsuarios,
        totalUsuarios: 1,
        createdAt: resultado.createdAt.toISOString(),
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new BadRequestException(
          'Já existe um usuário com este email de administrador',
        );
      }
      throw error;
    }
  }
}
