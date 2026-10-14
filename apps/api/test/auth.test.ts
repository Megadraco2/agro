import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { hashTokenSessao } from '../src/common/sessao-token';
import { PrismaService } from '../src/prisma/prisma.service';

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

  it('stores only the SHA-256 hash of the session token, never the raw cookie value', async () => {
    const email = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, { email, senha: 'senha-correta-123' });

    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, senha: 'senha-correta-123' })
      .expect(200);
    const setCookie = login.headers['set-cookie']![0] as string;
    const token = decodeURIComponent(setCookie.split(';')[0]!.split('=')[1]!);

    // 32 bytes aleatórios em base64url = 43 caracteres.
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const sessoes = await prisma.sessaoUsuario.findMany({
      where: { usuario: { email } },
    });
    expect(sessoes).toHaveLength(1);
    expect(sessoes[0]!.tokenHash).toBe(hashTokenSessao(token));
    expect(sessoes[0]!.id).not.toBe(token);
    expect(sessoes[0]!.tokenHash).not.toBe(token);
  });

  it('rejects requests with no session cookie', async () => {
    await request(app.getHttpServer()).get('/usuarios').expect(401);
  });
});
