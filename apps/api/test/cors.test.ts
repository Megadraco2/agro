import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

describe('CORS', () => {
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

  it('allows DELETE in a CORS preflight request', async () => {
    const response = await request(app.getHttpServer())
      .options('/propriedades/qualquer-id')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'DELETE')
      .expect(204);
    expect(response.headers['access-control-allow-methods']).toContain(
      'DELETE',
    );
  });
});
