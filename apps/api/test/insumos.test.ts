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

describe('Insumos', () => {
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

  it('creates and lists an insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Fox Supra',
      unidade: 'litro',
      precoUnitarioAtual: '100.0000',
    });

    const list = await request(app.getHttpServer())
      .get('/insumos')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('updates the preço unitário atual de um insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/insumos/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ precoUnitarioAtual: 110.5 })
      .expect(200);
    expect(updated.body.precoUnitarioAtual).toBe('110.5000');
  });

  it('rejects precoUnitarioAtual above the maximum', async () => {
    await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({
        nome: 'Insumo Caríssimo',
        unidade: 'litro',
        precoUnitarioAtual: 1_000_001,
      })
      .expect(400);
  });

  it('gets an Insumo by id', async () => {
    const criado = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);

    const obtido = await request(app.getHttpServer())
      .get(`/insumos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(obtido.body).toMatchObject({ nome: 'Fox Supra', unidade: 'litro' });
  });

  it('rejects deleting an Insumo referenced by a CompraInsumo', async () => {
    const { talhao, safra, insumo } = await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
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

    await request(app.getHttpServer())
      .delete(`/insumos/${insumo.id}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('deletes an Insumo with no history', async () => {
    const criado = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({ nome: 'Adubo X', unidade: 'kg', precoUnitarioAtual: 5 })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/insumos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/insumos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
