import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';

describe('Procedimentos', () => {
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

  it('creates and lists a procedimento', async () => {
    const created = await request(app.getHttpServer())
      .post('/procedimentos')
      .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: '1ª Aplicação de Fungicida',
      tipo: 'APLICACAO',
    });

    const list = await request(app.getHttpServer())
      .get('/procedimentos')
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects an unknown tipo', async () => {
    await request(app.getHttpServer())
      .post('/procedimentos')
      .send({ nome: 'Procedimento inválido', tipo: 'NAO_EXISTE' })
      .expect(400);
  });
});
