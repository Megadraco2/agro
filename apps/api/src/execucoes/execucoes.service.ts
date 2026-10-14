import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { ExecucaoResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { validarCustoDentroDoLimite } from '../common/limite-custo';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateExecucaoDto } from './execucoes.dto';

type ExecucaoRow = {
  id: string;
  safraId: string;
  talhaoId: string;
  procedimentoId: string;
  planejamentoItemId: string | null;
  data: Date;
  custoTotal: Prisma.Decimal;
  operador: string | null;
  maquina: string | null;
  quantidadeColhidaSacas: Prisma.Decimal | null;
  observacao: string | null;
  createdAt: Date;
  insumos: {
    insumoId: string;
    quantidade: Prisma.Decimal;
    precoUnitarioSnapshot: Prisma.Decimal;
  }[];
};

const EXECUCAO_INCLUDE = { insumos: true };

@Injectable()
export class ExecucoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(item: ExecucaoRow): ExecucaoResponse {
    return {
      id: item.id,
      safraId: item.safraId,
      talhaoId: item.talhaoId,
      procedimentoId: item.procedimentoId,
      planejamentoItemId: item.planejamentoItemId,
      data: item.data.toISOString(),
      custoTotal: item.custoTotal.toFixed(2),
      operador: item.operador,
      maquina: item.maquina,
      quantidadeColhidaSacas: item.quantidadeColhidaSacas?.toFixed(2) ?? null,
      observacao: item.observacao,
      insumos: item.insumos.map((i) => ({
        insumoId: i.insumoId,
        quantidade: i.quantidade.toFixed(4),
        precoUnitarioSnapshot: i.precoUnitarioSnapshot.toFixed(4),
      })),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<ExecucaoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const items = await this.prisma.execucaoItem.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        data: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      include: EXECUCAO_INCLUDE,
      orderBy: { data: 'asc' },
    });
    return items.map((item) => this.toResponse(item));
  }

  async create(dto: CreateExecucaoDto): Promise<ExecucaoResponse> {
    const organizacaoId = await this.currentOrg.getId();

    const [safra, talhao, procedimento] = await Promise.all([
      this.prisma.safra.findFirst({
        where: { id: dto.safraId, organizacaoId },
      }),
      this.prisma.talhao.findFirst({
        where: { id: dto.talhaoId, propriedade: { organizacaoId } },
      }),
      this.prisma.procedimento.findFirst({
        where: { id: dto.procedimentoId, organizacaoId },
      }),
    ]);
    if (!safra) throw new NotFoundException('Safra não encontrada');
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    if (!procedimento)
      throw new NotFoundException('Procedimento não encontrado');

    const data = new Date(dto.data);
    if (data < safra.dataInicio || data > safra.dataFim) {
      throw new BadRequestException('data fora do período da safra');
    }

    if (
      dto.quantidadeColhidaSacas !== undefined &&
      procedimento.tipo !== 'COLHEITA'
    ) {
      throw new BadRequestException(
        'quantidadeColhidaSacas só é permitido para procedimentos do tipo COLHEITA',
      );
    }

    if (dto.planejamentoItemId) {
      const planejamentoItem = await this.prisma.planejamentoItem.findFirst({
        where: { id: dto.planejamentoItemId, organizacaoId },
      });
      if (!planejamentoItem)
        throw new NotFoundException('Planejamento não encontrado');
      if (
        planejamentoItem.safraId !== dto.safraId ||
        planejamentoItem.talhaoId !== dto.talhaoId ||
        planejamentoItem.procedimentoId !== dto.procedimentoId
      ) {
        throw new BadRequestException(
          'A execução deve usar a mesma Safra, Talhão e Procedimento do planejamento vinculado',
        );
      }
    }

    const insumoIds = dto.insumos.map((i) => i.insumoId);
    const insumos = await this.prisma.insumo.findMany({
      where: { id: { in: insumoIds }, organizacaoId },
    });
    if (insumos.length !== insumoIds.length) {
      throw new NotFoundException('Um ou mais insumos não foram encontrados');
    }
    const insumoById = new Map(insumos.map((i) => [i.id, i]));

    let custoTotal = new Prisma.Decimal(0);
    const insumoRows = dto.insumos.map((item) => {
      const insumo = insumoById.get(item.insumoId);
      if (!insumo) throw new NotFoundException('Insumo não encontrado');
      const quantidade = new Prisma.Decimal(item.quantidade);
      custoTotal = custoTotal.add(quantidade.mul(insumo.precoUnitarioAtual));
      return {
        insumoId: item.insumoId,
        quantidade,
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
      };
    });

    validarCustoDentroDoLimite(custoTotal);

    const execucao = await this.prisma.execucaoItem.create({
      data: {
        organizacaoId,
        safraId: dto.safraId,
        talhaoId: dto.talhaoId,
        procedimentoId: dto.procedimentoId,
        planejamentoItemId: dto.planejamentoItemId ?? null,
        data,
        custoTotal: custoTotal.toDecimalPlaces(2),
        operador: dto.operador ?? null,
        maquina: dto.maquina ?? null,
        quantidadeColhidaSacas:
          dto.quantidadeColhidaSacas !== undefined
            ? new Prisma.Decimal(dto.quantidadeColhidaSacas.toFixed(2))
            : null,
        observacao: dto.observacao ?? null,
        insumos: { create: insumoRows },
      },
      include: EXECUCAO_INCLUDE,
    });

    return this.toResponse(execucao);
  }
}
