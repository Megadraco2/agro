import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Limpa todo o estado de domínio entre testes e resemeia a organização
 * padrão. `organizacao.deleteMany()` cascateia (onDelete: Cascade) e apaga
 * tudo — mas CurrentOrganizationService.getId() agora é só leitura (a
 * organização é dado de infraestrutura, semeado por migration, não criado
 * em request-time), então qualquer teste que exercite um endpoint
 * org-scoped precisa que a organização padrão volte a existir depois da
 * limpeza. Centralizado aqui para não duplicar essa lógica nos ~9 arquivos
 * de teste que precisam dela.
 */
export async function limparBanco(prisma: PrismaService): Promise<void> {
  await prisma.organizacao.deleteMany();
  await prisma.organizacao.create({
    data: { slug: 'default', nome: 'Organização Padrão' },
  });
}
