import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { readEnv } from '../src/env';
describe('Foundation API', () => {
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
  it('serves exactly the health contract without database', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(response.headers['cache-control']).toBe('no-store');
  });
  it('publishes health alongside domain routes in OpenAPI', async () => {
    const response = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(response.body.paths).toHaveProperty('/health');
  });
  it('restricts CORS to the configured origin', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(response.headers['access-control-allow-origin']).toBe(
      'http://localhost:3000',
    );
  });
  it('has no invented routes', async () => {
    await request(app.getHttpServer()).get('/customers').expect(404);
  });
  it('rejects missing or malformed backend environment', () => {
    expect(() => readEnv({})).toThrow('Variáveis inválidas');
    expect(() =>
      readEnv({ CORS_ORIGIN: '*', DATABASE_URL: 'secret', PORT: '0' }),
    ).toThrow();
    expect(
      readEnv({
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://localhost/agro',
      }).PORT,
    ).toBe(3001);
    expect(
      readEnv({
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://localhost/agro',
      }).TRUST_PROXY_HOPS,
    ).toBe(1);
    expect(
      readEnv({
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://localhost/agro',
        TRUST_PROXY_HOPS: '2',
      }).TRUST_PROXY_HOPS,
    ).toBe(2);
    expect(() =>
      readEnv({
        CORS_ORIGIN: 'http://localhost:3000',
        DATABASE_URL: 'postgresql://localhost/agro',
        TRUST_PROXY_HOPS: '-1',
      }),
    ).toThrow('TRUST_PROXY_HOPS');
  });
});
