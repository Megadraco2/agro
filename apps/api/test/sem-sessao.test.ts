import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

/**
 * Toda rota do domínio agrícola exige sessão de usuário (AuthGuard global).
 * Uma requisição sem header Cookie nenhum deve ser rejeitada com 401 antes
 * de chegar ao controller — inclusive antes da validação do corpo, por isso
 * os POSTs abaixo vão com corpo vazio.
 */
const ROTAS_DE_DOMINIO: { method: 'get' | 'post'; path: string }[] = [
  { method: 'get', path: '/propriedades' },
  { method: 'post', path: '/propriedades' },
  { method: 'get', path: '/propriedades/qualquer-id/talhoes' },
  { method: 'post', path: '/propriedades/qualquer-id/talhoes' },
  { method: 'get', path: '/safras' },
  { method: 'post', path: '/safras' },
  { method: 'get', path: '/procedimentos' },
  { method: 'post', path: '/procedimentos' },
  { method: 'get', path: '/insumos' },
  { method: 'post', path: '/insumos' },
  { method: 'get', path: '/planejamentos' },
  { method: 'post', path: '/planejamentos' },
  { method: 'get', path: '/execucoes' },
  { method: 'post', path: '/execucoes' },
  { method: 'get', path: '/compras-insumo' },
  { method: 'post', path: '/compras-insumo' },
];

describe('Rotas de domínio sem sessão', () => {
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

  it.each(ROTAS_DE_DOMINIO)(
    'rejects $method $path without a Cookie header with 401',
    async ({ method, path }) => {
      await request(app.getHttpServer())[method](path).send({}).expect(401);
    },
  );
});
