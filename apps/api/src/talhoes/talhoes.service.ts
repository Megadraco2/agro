import { Injectable, NotFoundException } from '@nestjs/common';
import type { TalhaoResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { excluirComRestricao } from '../common/excluir-com-restricao';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateTalhaoDto, UpdateTalhaoDto } from './talhoes.dto';

type TalhaoRow = {
  id: string;
  propriedadeId: string;
  nome: string;
  areaHa: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class TalhoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(talhao: TalhaoRow): TalhaoResponse {
    return {
      id: talhao.id,
      propriedadeId: talhao.propriedadeId,
      nome: talhao.nome,
      areaHa: talhao.areaHa.toFixed(2),
      createdAt: talhao.createdAt.toISOString(),
    };
  }

  private async getPropriedadeOrThrow(propriedadeId: string) {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.findFirst({
      where: { id: propriedadeId, organizacaoId },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  async list(propriedadeId: string): Promise<TalhaoResponse[]> {
    await this.getPropriedadeOrThrow(propriedadeId);
    const talhoes = await this.prisma.talhao.findMany({
      where: { propriedadeId },
      orderBy: { createdAt: 'asc' },
    });
    return talhoes.map((t) => this.toResponse(t));
  }

  async create(
    propriedadeId: string,
    dto: CreateTalhaoDto,
  ): Promise<TalhaoResponse> {
    await this.getPropriedadeOrThrow(propriedadeId);
    const talhao = await this.prisma.talhao.create({
      data: {
        propriedadeId,
        nome: dto.nome,
        areaHa: new Prisma.Decimal(dto.areaHa),
      },
    });
    return this.toResponse(talhao);
  }

  async getOrThrow(id: string): Promise<TalhaoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const talhao = await this.prisma.talhao.findFirst({
      where: { id, propriedade: { organizacaoId } },
    });
    if (!talhao) throw new NotFoundException('Talhão não encontrado');
    return talhao;
  }

  async getById(id: string): Promise<TalhaoResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(id: string, dto: UpdateTalhaoDto): Promise<TalhaoResponse> {
    await this.getOrThrow(id);
    const talhao = await this.prisma.talhao.update({
      where: { id },
      data: { nome: dto.nome, areaHa: new Prisma.Decimal(dto.areaHa) },
    });
    return this.toResponse(talhao);
  }

  async remove(id: string): Promise<void> {
    await this.getOrThrow(id);
    await excluirComRestricao(() =>
      this.prisma.talhao.delete({ where: { id } }),
    );
  }
}
