import { Injectable, NotFoundException } from '@nestjs/common';
import type { CompraInsumoResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCompraInsumoDto } from './compras-insumo.dto';

type CompraInsumoRow = {
  id: string;
  talhaoId: string;
  safraId: string;
  insumoId: string;
  data: Date;
  quantidade: Prisma.Decimal;
  precoUnitarioSnapshot: Prisma.Decimal;
  custoTotal: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class ComprasInsumoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(compra: CompraInsumoRow): CompraInsumoResponse {
    return {
      id: compra.id,
      talhaoId: compra.talhaoId,
      safraId: compra.safraId,
      insumoId: compra.insumoId,
      data: compra.data.toISOString(),
      quantidade: compra.quantidade.toFixed(4),
      precoUnitarioSnapshot: compra.precoUnitarioSnapshot.toFixed(4),
      custoTotal: compra.custoTotal.toFixed(2),
      createdAt: compra.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<CompraInsumoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const compras = await this.prisma.compraInsumo.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        data: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      orderBy: { data: 'asc' },
    });
    return compras.map((c) => this.toResponse(c));
  }

  async create(dto: CreateCompraInsumoDto): Promise<CompraInsumoResponse> {
    const organizacaoId = await this.currentOrg.getId();

    const [talhao, safra, insumo] = await Promise.all([
      this.prisma.talhao.findUnique({ where: { id: dto.talhaoId } }),
      this.prisma.safra.findUnique({ where: { id: dto.safraId } }),
      this.prisma.insumo.findUnique({ where: { id: dto.insumoId } }),
    ]);
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    if (!safra) throw new NotFoundException('Safra não encontrada');
    if (!insumo) throw new NotFoundException('Insumo não encontrado');

    const custoTotal = dto.quantidade * insumo.precoUnitarioAtual.toNumber();

    const compra = await this.prisma.compraInsumo.create({
      data: {
        organizacaoId,
        talhaoId: dto.talhaoId,
        safraId: dto.safraId,
        insumoId: dto.insumoId,
        data: new Date(dto.data),
        quantidade: new Prisma.Decimal(dto.quantidade),
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
        custoTotal: new Prisma.Decimal(custoTotal.toFixed(2)),
      },
    });

    return this.toResponse(compra);
  }
}
