import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Compras de Insumo', () => {
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

  it('creates a compra de insumo and computes custoTotal from the current price', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumo.id,
        data: new Date().toISOString(),
        quantidade: 91,
      })
      .expect(201);

    // custoTotal = 91 l * R$100/l = R$9.100,00
    expect(compra.body.custoTotal).toBe('9100.00');
    expect(compra.body.precoUnitarioSnapshot).toBe('100.0000');

    const list = await request(app.getHttpServer())
      .get(`/compras-insumo?talhaoId=${talhao.id}`)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('keeps custoTotal and precoUnitarioSnapshot unchanged after the insumo price changes', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumo.id,
        data: new Date().toISOString(),
        quantidade: 91,
      })
      .expect(201);
    expect(compra.body.custoTotal).toBe('9100.00');
    expect(compra.body.precoUnitarioSnapshot).toBe('100.0000');

    await request(app.getHttpServer())
      .patch(`/insumos/${insumo.id}`)
      .send({ precoUnitarioAtual: 999 })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`/compras-insumo?talhaoId=${talhao.id}`)
      .expect(200);
    const encontrada = list.body.find(
      (item: { id: string }) => item.id === compra.body.id,
    );
    expect(encontrada.custoTotal).toBe('9100.00');
    expect(encontrada.precoUnitarioSnapshot).toBe('100.0000');
  });

  it('rejects compra referencing an unknown insumo', async () => {
    const { talhao, safra } = await criarFixturesAgricolas(app);
    await request(app.getHttpServer())
      .post('/compras-insumo')
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: 'nao-existe',
        data: new Date().toISOString(),
        quantidade: 1,
      })
      .expect(404);
  });
});
