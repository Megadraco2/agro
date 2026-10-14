import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';

describe('Insumos', () => {
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

  it('creates and lists an insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Fox Supra',
      unidade: 'litro',
      precoUnitarioAtual: '100.0000',
    });

    const list = await request(app.getHttpServer()).get('/insumos').expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('updates the preço unitário atual de um insumo', async () => {
    const created = await request(app.getHttpServer())
      .post('/insumos')
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/insumos/${created.body.id}`)
      .send({ precoUnitarioAtual: 110.5 })
      .expect(200);
    expect(updated.body.precoUnitarioAtual).toBe('110.5000');
  });
});
