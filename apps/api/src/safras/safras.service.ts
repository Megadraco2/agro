import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { SafraResponse } from '@agro/contracts';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateSafraDto, UpdateSafraDto } from './safras.dto';

type SafraRow = {
  id: string;
  nome: string;
  cultura: string;
  dataInicio: Date;
  dataFim: Date;
  createdAt: Date;
};

@Injectable()
export class SafrasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(safra: SafraRow): SafraResponse {
    return {
      id: safra.id,
      nome: safra.nome,
      cultura: safra.cultura,
      dataInicio: safra.dataInicio.toISOString(),
      dataFim: safra.dataFim.toISOString(),
      createdAt: safra.createdAt.toISOString(),
    };
  }

  async list(): Promise<SafraResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const safras = await this.prisma.safra.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return safras.map((s) => this.toResponse(s));
  }

  async create(dto: CreateSafraDto): Promise<SafraResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const safra = await this.prisma.safra.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        cultura: dto.cultura,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
      },
    });
    return this.toResponse(safra);
  }

  async getOrThrow(id: string): Promise<SafraRow> {
    const safra = await this.prisma.safra.findUnique({ where: { id } });
    if (!safra) throw new NotFoundException('Safra não encontrada');
    return safra;
  }

  async getById(id: string): Promise<SafraResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateSafraDto): Promise<SafraResponse> {
    const atual = await this.getOrThrow(id);
    const novaDataInicio = new Date(dto.dataInicio);
    const novaDataFim = new Date(dto.dataFim);

    // Alargar a janela nunca invalida um registro já vinculado — só
    // precisa revalidar quando a janela nova é mais estreita que a atual.
    const janelaEstreitou =
      novaDataInicio > atual.dataInicio || novaDataFim < atual.dataFim;
    if (janelaEstreitou) {
      await this.garantirRegistrosDentroDaNovaJanela(
        id,
        novaDataInicio,
        novaDataFim,
      );
    }

    const safra = await this.prisma.safra.update({
      where: { id },
      data: {
        nome: dto.nome,
        cultura: dto.cultura,
        dataInicio: novaDataInicio,
        dataFim: novaDataFim,
      },
    });
    return this.toResponse(safra);
  }

  private async garantirRegistrosDentroDaNovaJanela(
    safraId: string,
    dataInicio: Date,
    dataFim: Date,
  ): Promise<void> {
    const [planejamentoForaDaJanela, execucaoForaDaJanela] = await Promise.all([
      this.prisma.planejamentoItem.findFirst({
        where: {
          safraId,
          OR: [
            { dataPrevista: { lt: dataInicio } },
            { dataPrevista: { gt: dataFim } },
          ],
        },
      }),
      this.prisma.execucaoItem.findFirst({
        where: {
          safraId,
          OR: [{ data: { lt: dataInicio } }, { data: { gt: dataFim } }],
        },
      }),
    ]);

    if (planejamentoForaDaJanela || execucaoForaDaJanela) {
      throw new BadRequestException(
        'Não é possível estreitar o período da safra: já existem planejamentos ou execuções registrados fora da nova janela.',
      );
    }
  }
}
