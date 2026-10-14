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

describe('Talhões', () => {
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

  async function criarPropriedade() {
    const response = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    return response.body;
  }

  it('creates and lists talhões de uma propriedade', async () => {
    const propriedade = await criarPropriedade();

    const created = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.id}/talhoes`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(201);
    expect(created.body).toMatchObject({
      propriedadeId: propriedade.id,
      nome: 'Talhão 1',
      areaHa: '2000.00',
    });

    const list = await request(app.getHttpServer())
      .get(`/propriedades/${propriedade.id}/talhoes`)
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects areaHa above the maximum', async () => {
    const propriedade = await criarPropriedade();
    await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.id}/talhoes`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão Gigante', areaHa: 1_000_001 })
      .expect(400);
  });

  it('rejects talhão for an unknown propriedade', async () => {
    await request(app.getHttpServer())
      .post('/propriedades/nao-existe/talhoes')
      .set('Cookie', cookie)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(404);
  });

  it('gets and updates a talhão by id', async () => {
    const propriedade = await criarPropriedade();
    const created = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.id}/talhoes`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/talhoes/${created.body.id}`)
      .set('Cookie', cookie)
      .expect(200);

    const updated = await request(app.getHttpServer())
      .patch(`/talhoes/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão 1A', areaHa: 2500 })
      .expect(200);
    expect(updated.body).toMatchObject({
      nome: 'Talhão 1A',
      areaHa: '2500.00',
    });
  });

  it('rejects deleting a Talhão with Planejamento history', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/talhoes/${talhao.id}`)
      .set('Cookie', cookie)
      .expect(400);

    await request(app.getHttpServer())
      .get(`/talhoes/${talhao.id}`)
      .set('Cookie', cookie)
      .expect(200);
  });

  it('deletes a Talhão with no history', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .delete(`/talhoes/${talhao.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/talhoes/${talhao.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
