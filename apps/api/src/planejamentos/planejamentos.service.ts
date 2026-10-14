import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { PlanejamentoResponse, PlanejamentoStatus } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { ListFiltersDto } from '../common/list-filters.dto';
import { validarCustoDentroDoLimite } from '../common/limite-custo';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreatePlanejamentoDto } from './planejamentos.dto';

type PlanejamentoRow = {
  id: string;
  safraId: string;
  talhaoId: string;
  procedimentoId: string;
  dataPrevista: Date;
  custoEstimado: Prisma.Decimal;
  observacao: string | null;
  createdAt: Date;
  insumos: {
    insumoId: string;
    dosePorHa: Prisma.Decimal;
    precoUnitarioSnapshot: Prisma.Decimal;
  }[];
  execucoes: { id: string }[];
};

const PLANEJAMENTO_INCLUDE = {
  insumos: true,
  execucoes: { select: { id: true } },
};

@Injectable()
export class PlanejamentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private computeStatus(item: PlanejamentoRow): PlanejamentoStatus {
    if (item.execucoes.length > 0) return 'EXECUTADO';
    return item.dataPrevista.getTime() < Date.now() ? 'ATRASADO' : 'PLANEJADO';
  }

  private toResponse(item: PlanejamentoRow): PlanejamentoResponse {
    return {
      id: item.id,
      safraId: item.safraId,
      talhaoId: item.talhaoId,
      procedimentoId: item.procedimentoId,
      dataPrevista: item.dataPrevista.toISOString(),
      custoEstimado: item.custoEstimado.toFixed(2),
      observacao: item.observacao,
      status: this.computeStatus(item),
      insumos: item.insumos.map((i) => ({
        insumoId: i.insumoId,
        dosePorHa: i.dosePorHa.toFixed(4),
        precoUnitarioSnapshot: i.precoUnitarioSnapshot.toFixed(4),
      })),
      createdAt: item.createdAt.toISOString(),
    };
  }

  async list(filters: ListFiltersDto): Promise<PlanejamentoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const items = await this.prisma.planejamentoItem.findMany({
      where: {
        organizacaoId,
        safraId: filters.safraId,
        talhaoId: filters.talhaoId,
        dataPrevista: {
          gte: filters.de ? new Date(filters.de) : undefined,
          lte: filters.ate ? new Date(filters.ate) : undefined,
        },
      },
      include: PLANEJAMENTO_INCLUDE,
      orderBy: { dataPrevista: 'asc' },
    });
    return items.map((item) => this.toResponse(item));
  }

  async create(dto: CreatePlanejamentoDto): Promise<PlanejamentoResponse> {
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

    const dataPrevista = new Date(dto.dataPrevista);
    if (dataPrevista < safra.dataInicio || dataPrevista > safra.dataFim) {
      throw new BadRequestException('dataPrevista fora do período da safra');
    }

    const insumoIds = dto.insumos.map((i) => i.insumoId);
    const insumos = await this.prisma.insumo.findMany({
      where: { id: { in: insumoIds }, organizacaoId },
    });
    if (insumos.length !== insumoIds.length) {
      throw new NotFoundException('Um ou mais insumos não foram encontrados');
    }
    const insumoById = new Map(insumos.map((i) => [i.id, i]));

    let custoEstimado = new Prisma.Decimal(0);
    const insumoRows = dto.insumos.map((item) => {
      const insumo = insumoById.get(item.insumoId);
      if (!insumo) throw new NotFoundException('Insumo não encontrado');
      const dosePorHa = new Prisma.Decimal(item.dosePorHa);
      custoEstimado = custoEstimado.add(
        dosePorHa.mul(talhao.areaHa).mul(insumo.precoUnitarioAtual),
      );
      return {
        insumoId: item.insumoId,
        dosePorHa,
        precoUnitarioSnapshot: insumo.precoUnitarioAtual,
      };
    });

    validarCustoDentroDoLimite(custoEstimado);

    const planejamento = await this.prisma.planejamentoItem.create({
      data: {
        organizacaoId,
        safraId: dto.safraId,
        talhaoId: dto.talhaoId,
        procedimentoId: dto.procedimentoId,
        dataPrevista,
        custoEstimado: custoEstimado.toDecimalPlaces(2),
        observacao: dto.observacao ?? null,
        insumos: { create: insumoRows },
      },
      include: PLANEJAMENTO_INCLUDE,
    });

    return this.toResponse(planejamento);
  }

  async getOrThrow(id: string): Promise<PlanejamentoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const item = await this.prisma.planejamentoItem.findFirst({
      where: { id, organizacaoId },
      include: PLANEJAMENTO_INCLUDE,
    });
    if (!item) throw new NotFoundException('Planejamento não encontrado');
    return item;
  }

  async getById(id: string): Promise<PlanejamentoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async remove(id: string): Promise<void> {
    const organizacaoId = await this.currentOrg.getId();
    const { count } = await this.prisma.planejamentoItem.deleteMany({
      where: { id, organizacaoId, execucoes: { none: {} } },
    });
    if (count === 0) {
      // Ou o Planejamento não existe (org errada, id errado), ou ele tem ao
      // menos uma Execução vinculada — distinguir os dois casos para manter
      // 404 vs 400 corretos.
      const existe = await this.prisma.planejamentoItem.findFirst({
        where: { id, organizacaoId },
        select: { id: true },
      });
      if (!existe) {
        throw new NotFoundException('Planejamento não encontrado');
      }
      throw new BadRequestException(
        'Não é possível excluir um planejamento já executado',
      );
    }
  }
}
