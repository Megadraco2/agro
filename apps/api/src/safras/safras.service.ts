import { Injectable, NotFoundException } from '@nestjs/common';
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
    await this.getOrThrow(id);
    const safra = await this.prisma.safra.update({
      where: { id },
      data: {
        nome: dto.nome,
        cultura: dto.cultura,
        dataInicio: new Date(dto.dataInicio),
        dataFim: new Date(dto.dataFim),
      },
    });
    return this.toResponse(safra);
  }
}
