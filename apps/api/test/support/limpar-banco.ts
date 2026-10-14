import type { PrismaService } from '../../src/prisma/prisma.service';

/**
 * Limpa todo o estado de domínio entre testes e resemeia a organização
 * padrão. As FKs de catálogo (Insumo/Procedimento/Safra/Talhão) para
 * entidade transacional são ON DELETE RESTRICT (docs/BACKLOG.md #6) — por
 * isso a ordem de exclusão abaixo é explícita (filhos antes dos pais) em
 * vez de depender de `organizacao.deleteMany()` cascatear tudo numa única
 * instrução: a ordem em que o Postgres resolve cascatas concorrentes de
 * caminhos diferentes (ex: Organizacao->Insumo e Organizacao->
 * PlanejamentoItem->PlanejamentoInsumo->Insumo) não é garantida, e pode
 * tentar apagar o Insumo antes do PlanejamentoInsumo que ainda o referencia.
 *
 * CurrentOrganizationService.getId() é só leitura (a organização é dado de
 * infraestrutura, semeado por migration, não criado em request-time), então
 * qualquer teste que exercite um endpoint org-scoped precisa que a
 * organização padrão volte a existir depois da limpeza. Centralizado aqui
 * para não duplicar essa lógica nos ~9 arquivos de teste que precisam dela.
 */
export async function limparBanco(prisma: PrismaService): Promise<void> {
  await prisma.execucaoInsumo.deleteMany();
  await prisma.planejamentoInsumo.deleteMany();
  await prisma.compraInsumo.deleteMany();
  await prisma.execucaoItem.deleteMany();
  await prisma.planejamentoItem.deleteMany();
  await prisma.talhao.deleteMany();
  await prisma.insumo.deleteMany();
  await prisma.procedimento.deleteMany();
  await prisma.safra.deleteMany();
  await prisma.propriedade.deleteMany();
  await prisma.organizacao.deleteMany();
  await prisma.organizacao.create({
    data: { slug: 'default', nome: 'Organização Padrão' },
  });
}
