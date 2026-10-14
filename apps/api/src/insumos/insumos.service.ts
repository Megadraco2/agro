import { Injectable, NotFoundException } from '@nestjs/common';
import type { InsumoResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateInsumoDto, UpdateInsumoPrecoDto } from './insumos.dto';

type InsumoRow = {
  id: string;
  nome: string;
  unidade: string;
  precoUnitarioAtual: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class InsumosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(insumo: InsumoRow): InsumoResponse {
    return {
      id: insumo.id,
      nome: insumo.nome,
      unidade: insumo.unidade,
      precoUnitarioAtual: insumo.precoUnitarioAtual.toFixed(4),
      createdAt: insumo.createdAt.toISOString(),
    };
  }

  async list(): Promise<InsumoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const insumos = await this.prisma.insumo.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return insumos.map((i) => this.toResponse(i));
  }

  async create(dto: CreateInsumoDto): Promise<InsumoResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const insumo = await this.prisma.insumo.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        unidade: dto.unidade,
        precoUnitarioAtual: new Prisma.Decimal(dto.precoUnitarioAtual),
      },
    });
    return this.toResponse(insumo);
  }

  async getOrThrow(id: string): Promise<InsumoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const insumo = await this.prisma.insumo.findFirst({
      where: { id, organizacaoId },
    });
    if (!insumo) throw new NotFoundException('Insumo não encontrado');
    return insumo;
  }

  async updatePreco(
    id: string,
    dto: UpdateInsumoPrecoDto,
  ): Promise<InsumoResponse> {
    await this.getOrThrow(id);
    const insumo = await this.prisma.insumo.update({
      where: { id },
      data: { precoUnitarioAtual: new Prisma.Decimal(dto.precoUnitarioAtual) },
    });
    return this.toResponse(insumo);
  }
}
