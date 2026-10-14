import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { autenticarComoOrgAdmin } from './support/autenticar';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Compras de Insumo', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;

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
    cookie = await autenticarComoOrgAdmin(prisma);
  });

  it('creates a compra de insumo and computes custoTotal from the current price', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('keeps custoTotal and precoUnitarioSnapshot unchanged after the insumo price changes', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
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
      .set('Cookie', cookie)
      .send({ precoUnitarioAtual: 999 })
      .expect(200);

    const list = await request(app.getHttpServer())
      .get(`/compras-insumo?talhaoId=${talhao.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const encontrada = list.body.find(
      (item: { id: string }) => item.id === compra.body.id,
    );
    expect(encontrada.custoTotal).toBe('9100.00');
    expect(encontrada.precoUnitarioSnapshot).toBe('100.0000');
  });

  it('rejects quantidade above the maximum', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumo.id,
        data: new Date().toISOString(),
        quantidade: 10_000_001,
      })
      .expect(400);
  });

  it('rejects when the computed custoTotal would exceed the storable limit', async () => {
    const { talhao, safra } = await criarFixturesAgricolas(app, cookie);
    const insumoCaro = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({
        nome: 'Insumo Caríssimo',
        unidade: 'litro',
        precoUnitarioAtual: 1_000_000,
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumoCaro.body.id,
        data: new Date().toISOString(),
        // 1.000.000 l * R$1.000.000/l = R$1.000.000.000.000 (acima do limite)
        quantidade: 1_000_000,
      })
      .expect(400);
  });

  it('rejects compra referencing an unknown insumo', async () => {
    const { talhao, safra } = await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: 'nao-existe',
        data: new Date().toISOString(),
        quantidade: 1,
      })
      .expect(404);
  });

  it('gets a CompraInsumo by id', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

    const compra = await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookie)
      .send({
        talhaoId: talhao.id,
        safraId: safra.id,
        insumoId: insumo.id,
        data: new Date().toISOString(),
        quantidade: 10,
      })
      .expect(201);

    const obtida = await request(app.getHttpServer())
      .get(`/compras-insumo/${compra.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(obtida.body.id).toBe(compra.body.id);
  });
});
