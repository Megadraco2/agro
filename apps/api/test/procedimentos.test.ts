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

describe('Procedimentos', () => {
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

  it('creates and lists a procedimento', async () => {
    const created = await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: '1ª Aplicação de Fungicida',
      tipo: 'APLICACAO',
    });

    const list = await request(app.getHttpServer())
      .get('/procedimentos')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects an unknown tipo', async () => {
    await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: 'Procedimento inválido', tipo: 'NAO_EXISTE' })
      .expect(400);
  });

  it('gets a Procedimento by id', async () => {
    const criado = await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
      .expect(201);

    const obtido = await request(app.getHttpServer())
      .get(`/procedimentos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(obtido.body).toMatchObject({
      nome: '1ª Aplicação de Fungicida',
      tipo: 'APLICACAO',
    });
  });

  it('updates a Procedimento', async () => {
    const criado = await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: 'Aplicação de Herbicida', tipo: 'APLICACAO' })
      .expect(201);

    const atualizado = await request(app.getHttpServer())
      .patch(`/procedimentos/${criado.body.id}`)
      .set('Cookie', cookie)
      .send({ nome: 'Aplicação de Herbicida (revisado)', tipo: 'APLICACAO' })
      .expect(200);
    expect(atualizado.body.nome).toBe('Aplicação de Herbicida (revisado)');
  });

  it('rejects deleting a Procedimento with Planejamento history', async () => {
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
      .delete(`/procedimentos/${procedimento.id}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('deletes a Procedimento with no history', async () => {
    const criado = await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: 'Desfolha', tipo: 'OUTRO' })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/procedimentos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/procedimentos/${criado.body.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
