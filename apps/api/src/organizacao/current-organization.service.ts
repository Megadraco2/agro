import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ORGANIZACAO_PADRAO_SLUG = 'default';

@Injectable()
export class CurrentOrganizationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Resolve o id da organização atual. Só leitura — a organização padrão é
   * dado de infraestrutura, semeado pela migration
   * 20261014064841_add_organizacao_slug_seed_default, nunca criado em
   * request-time. Isso elimina qualquer janela de corrida (duas requisições
   * concorrentes não podem mais criar duas organizações).
   */
  async getId(): Promise<string> {
    const organizacao = await this.prisma.organizacao.findUnique({
      where: { slug: ORGANIZACAO_PADRAO_SLUG },
    });
    if (!organizacao) {
      throw new InternalServerErrorException(
        'Organização padrão não encontrada. Confirme se as migrations foram aplicadas (pnpm --filter @agro/api db:migrate:deploy) — ver docs/DATABASE.md.',
      );
    }
    return organizacao.id;
  }
}
