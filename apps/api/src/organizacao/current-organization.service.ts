import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CurrentOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  async getId(): Promise<string> {
    const existing = await this.prisma.organizacao.findFirst();
    if (existing) return existing.id;
    const created = await this.prisma.organizacao.create({
      data: { nome: 'Organização Padrão' },
    });
    return created.id;
  }
}
