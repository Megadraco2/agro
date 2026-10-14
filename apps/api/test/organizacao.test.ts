import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import { PrismaModule } from '../src/prisma/prisma.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { OrganizacaoModule } from '../src/organizacao/organizacao.module';
import { CurrentOrganizationService } from '../src/organizacao/current-organization.service';

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

  beforeEach(async () => {
    await prisma.organizacao.deleteMany();
  });

  it('creates the default organization when none exists', async () => {
    const id = await service.getId();
    const all = await prisma.organizacao.findMany();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe(id);
  });

  it('reuses the existing organization instead of creating a second one', async () => {
    const first = await service.getId();
    const second = await service.getId();
    expect(second).toBe(first);
    const all = await prisma.organizacao.findMany();
    expect(all).toHaveLength(1);
  });
});
