import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Safras', () => {
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
    await prisma.organizacao.deleteMany();
  });

  it('creates and lists a safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
    });

    const list = await request(app.getHttpServer()).get('/safras').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects dataFim before dataInicio', async () => {
    await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Safra inválida',
        cultura: 'Soja',
        dataInicio: '2026-06-01T00:00:00.000Z',
        dataFim: '2025-06-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('updates an existing safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/safras/${created.body.id}`)
      .send({
        nome: 'Colheitas 25/26 Soja (revisada)',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-07-01T00:00:00.000Z',
      })
      .expect(200);
    expect(updated.body.nome).toBe('Colheitas 25/26 Soja (revisada)');
  });
});
