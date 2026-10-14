import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

describe('Rate limit no login', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks the 6th login attempt within a minute from the same client', async () => {
    for (let tentativa = 1; tentativa <= 5; tentativa++) {
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'inexistente@teste.com', senha: 'qualquer' })
        .expect(401);
    }
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'inexistente@teste.com', senha: 'qualquer' })
      .expect(429);
  });
});
