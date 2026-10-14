import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { criarFixturesAgricolas } from './support/fixtures';

/**
 * Não existe rota DELETE em nenhum controller (docs/BACKLOG.md #6) — estes
 * testes exercitam a trava diretamente via Prisma Client, provando que o
 * banco em si impede apagar um registro de catálogo que ainda tem
 * histórico financeiro vinculado, independente de qualquer rota futura.
 */
describe('Integridade referencial catálogo → transacional', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  it('rejects deleting an Insumo referenced by a PlanejamentoInsumo', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await expect(
      prisma.insumo.delete({ where: { id: insumo.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('rejects deleting a Safra referenced by a PlanejamentoItem', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await expect(
      prisma.safra.delete({ where: { id: safra.id } }),
    ).rejects.toMatchObject({ code: 'P2003' });
  });

  it('allows deleting a catalog record with no transactional history', async () => {
    const { insumo } = await criarFixturesAgricolas(app);
    await expect(
      prisma.insumo.delete({ where: { id: insumo.id } }),
    ).resolves.toMatchObject({ id: insumo.id });
  });
});
