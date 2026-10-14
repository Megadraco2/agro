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

describe('Propriedades', () => {
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

  it('creates and lists a propriedade', async () => {
    const created = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Fazenda Esperança',
      areaHa: '10000.00',
    });

    const list = await request(app.getHttpServer())
      .get('/propriedades')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
  });

  it('rejects creation with missing fields', async () => {
    await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Sem área' })
      .expect(400);
  });

  it('rejects areaHa above the maximum', async () => {
    await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Gigante', areaHa: 1_000_001 })
      .expect(400);
  });

  it('returns 404 for unknown propriedade', async () => {
    await request(app.getHttpServer())
      .get('/propriedades/unknown-id')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('updates an existing propriedade', async () => {
    const created = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Vitória', areaHa: 4000 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/propriedades/${created.body.id}`)
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Vitória', areaHa: 4500 })
      .expect(200);
    expect(updated.body.areaHa).toBe('4500.00');
  });

  it('rejects deleting a Propriedade whose Talhão has history', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    const propriedadeId = talhao.propriedadeId;

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
      .delete(`/propriedades/${propriedadeId}`)
      .set('Cookie', cookie)
      .expect(400);

    const lista = await request(app.getHttpServer())
      .get('/propriedades')
      .set('Cookie', cookie)
      .expect(200);
    expect(lista.body).toHaveLength(1);
  });

  it('deletes a Propriedade with no history', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookie);
    const propriedadeId = talhao.propriedadeId;

    await request(app.getHttpServer())
      .delete(`/propriedades/${propriedadeId}`)
      .set('Cookie', cookie)
      .expect(204);

    const lista = await request(app.getHttpServer())
      .get('/propriedades')
      .set('Cookie', cookie)
      .expect(200);
    expect(lista.body).toHaveLength(0);
  });
});
