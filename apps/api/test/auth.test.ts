import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';

async function criarOrganizacaoDeTeste(
  app: INestApplication,
  overrides: { email: string; senha: string },
) {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  const cookieAdmin = loginAdmin.headers['set-cookie']![0] as string;

  const organizacao = await request(app.getHttpServer())
    .post('/admin/organizacoes')
    .set('Cookie', cookieAdmin)
    .send({
      nome: `Org ${Date.now()}`,
      maxUsuarios: 3,
      adminEmail: overrides.email,
      adminSenha: overrides.senha,
    })
    .expect(201);
  return organizacao.body.id as string;
}

describe('Auth de organização', () => {
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

  it('rejects login with wrong credentials', async () => {
    const email = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, { email, senha: 'senha-correta-123' });
    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-errada' })
      .expect(401);
  });

  it('logs in, accesses /usuarios, then logs out and loses access', async () => {
    const email = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, { email, senha: 'senha-correta-123' });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-correta-123' })
      .expect(200);
    const cookie = login.headers['set-cookie']![0] as string;

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookie)
      .expect(200);

    await request(app.getHttpServer())
      .post('/auth/logout')
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookie)
      .expect(401);
  });

  it('rejects requests with no session cookie', async () => {
    await request(app.getHttpServer()).get('/usuarios').expect(401);
  });
});
