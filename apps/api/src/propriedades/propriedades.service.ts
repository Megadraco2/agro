import { Injectable, NotFoundException } from '@nestjs/common';
import type { PropriedadeResponse } from '@agro/contracts';
import { Prisma } from '../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type {
  CreatePropriedadeDto,
  UpdatePropriedadeDto,
} from './propriedades.dto';

type PropriedadeRow = {
  id: string;
  nome: string;
  areaHa: Prisma.Decimal;
  createdAt: Date;
};

@Injectable()
export class PropriedadesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(propriedade: PropriedadeRow): PropriedadeResponse {
    return {
      id: propriedade.id,
      nome: propriedade.nome,
      areaHa: propriedade.areaHa.toFixed(2),
      createdAt: propriedade.createdAt.toISOString(),
    };
  }

  async list(): Promise<PropriedadeResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedades = await this.prisma.propriedade.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return propriedades.map((p) => this.toResponse(p));
  }

  async create(dto: CreatePropriedadeDto): Promise<PropriedadeResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.create({
      data: {
        organizacaoId,
        nome: dto.nome,
        areaHa: new Prisma.Decimal(dto.areaHa),
      },
    });
    return this.toResponse(propriedade);
  }

  async getOrThrow(id: string): Promise<PropriedadeRow> {
    const organizacaoId = await this.currentOrg.getId();
    const propriedade = await this.prisma.propriedade.findFirst({
      where: { id, organizacaoId },
    });
    if (!propriedade) throw new NotFoundException('Propriedade não encontrada');
    return propriedade;
  }

  async getById(id: string): Promise<PropriedadeResponse> {
    return this.toResponse(await this.getOrThrow(id));
  }

  async update(
    id: string,
    dto: UpdatePropriedadeDto,
  ): Promise<PropriedadeResponse> {
    await this.getOrThrow(id);
    const propriedade = await this.prisma.propriedade.update({
      where: { id },
      data: { nome: dto.nome, areaHa: new Prisma.Decimal(dto.areaHa) },
    });
    return this.toResponse(propriedade);
  }
}
