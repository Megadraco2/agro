import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrganizacaoModule } from '../src/organizacao/organizacao.module';
import { CurrentOrganizationService } from '../src/organizacao/current-organization.service';
import { limparBanco } from './support/limpar-banco';

describe('CurrentOrganizationService', () => {
  let prisma: PrismaService;
  let service: CurrentOrganizationService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [PrismaModule, OrganizacaoModule],
    }).compile();
    prisma = module.get(PrismaService);
    service = module.get(CurrentOrganizationService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('resolves the id of the seeded default organization', async () => {
    await limparBanco(prisma);
    const id = await service.getId();
    const organizacao = await prisma.organizacao.findUniqueOrThrow({
      where: { slug: 'default' },
    });
    expect(id).toBe(organizacao.id);
  });

  it('throws clearly when the default organization is missing', async () => {
    // Não usa limparBanco aqui de propósito: queremos o banco genuinamente
    // sem nenhuma organização, para provar que getId() falha alto em vez de
    // criar uma silenciosamente (a criação só acontece via migration).
    await prisma.organizacao.deleteMany();
    await expect(service.getId()).rejects.toThrow(
      'Organização padrão não encontrada',
    );
  });
});
