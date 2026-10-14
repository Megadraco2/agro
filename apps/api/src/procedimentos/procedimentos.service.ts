import { Injectable, NotFoundException } from '@nestjs/common';
import type { ProcedimentoResponse } from '@agro/contracts';
import { TipoProcedimento } from '../generated/prisma/client';
import { CurrentOrganizationService } from '../organizacao/current-organization.service';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateProcedimentoDto } from './procedimentos.dto';

type ProcedimentoRow = {
  id: string;
  nome: string;
  tipo: TipoProcedimento;
  createdAt: Date;
};

@Injectable()
export class ProcedimentosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly currentOrg: CurrentOrganizationService,
  ) {}

  private toResponse(procedimento: ProcedimentoRow): ProcedimentoResponse {
    return {
      id: procedimento.id,
      nome: procedimento.nome,
      tipo: procedimento.tipo,
      createdAt: procedimento.createdAt.toISOString(),
    };
  }

  async list(): Promise<ProcedimentoResponse[]> {
    const organizacaoId = await this.currentOrg.getId();
    const procedimentos = await this.prisma.procedimento.findMany({
      where: { organizacaoId },
      orderBy: { createdAt: 'asc' },
    });
    return procedimentos.map((p) => this.toResponse(p));
  }

  async create(dto: CreateProcedimentoDto): Promise<ProcedimentoResponse> {
    const organizacaoId = await this.currentOrg.getId();
    const procedimento = await this.prisma.procedimento.create({
      data: { organizacaoId, nome: dto.nome, tipo: dto.tipo },
    });
    return this.toResponse(procedimento);
  }

  async getOrThrow(id: string): Promise<ProcedimentoRow> {
    const organizacaoId = await this.currentOrg.getId();
    const procedimento = await this.prisma.procedimento.findFirst({
      where: { id, organizacaoId },
    });
    if (!procedimento)
      throw new NotFoundException('Procedimento não encontrado');
    return procedimento;
  }
}
