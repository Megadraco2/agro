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
      maxUsuarios: 2,
      adminEmail: overrides.email,
      adminSenha: overrides.senha,
    })
    .expect(201);
  return organizacao.body.id as string;
}

async function logarComo(app: INestApplication, email: string, senha: string) {
  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, senha })
    .expect(200);
  return login.headers['set-cookie']![0] as string;
}

describe('Usuários', () => {
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

  it('ORG_ADMIN creates an ORG_MEMBER, which then cannot create more users', async () => {
    const chefeEmail = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeEmail,
      senha: 'senha-do-chefe-123',
    });
    const cookieChefe = await logarComo(app, chefeEmail, 'senha-do-chefe-123');

    const membroEmail = `membro-${Date.now()}@teste.com`;
    const criado = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({ email: membroEmail, senha: 'senha-do-membro-123' })
      .expect(201);
    expect(criado.body.papel).toBe('ORG_MEMBER');

    const cookieMembro = await logarComo(
      app,
      membroEmail,
      'senha-do-membro-123',
    );
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieMembro)
      .send({ email: `outro-${Date.now()}@teste.com`, senha: 'senha-123456' })
      .expect(403);
  });

  it('rejects creating a user beyond maxUsuarios', async () => {
    const chefeEmail = `chefe-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeEmail,
      senha: 'senha-do-chefe-123',
    });
    const cookieChefe = await logarComo(app, chefeEmail, 'senha-do-chefe-123');

    // maxUsuarios é 2: o chefe já conta como 1, então só cabe mais 1.
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({
        email: `membro-${Date.now()}@teste.com`,
        senha: 'senha-123456',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', cookieChefe)
      .send({
        email: `membro-excedente-${Date.now()}@teste.com`,
        senha: 'senha-123456',
      })
      .expect(400);
  });

  it('lists only users from the caller’s own organization', async () => {
    const chefeA = `chefe-a-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeA,
      senha: 'senha-chefe-a-123',
    });
    const chefeB = `chefe-b-${Date.now()}@teste.com`;
    await criarOrganizacaoDeTeste(app, {
      email: chefeB,
      senha: 'senha-chefe-b-123',
    });

    const cookieA = await logarComo(app, chefeA, 'senha-chefe-a-123');
    const lista = await request(app.getHttpServer())
      .get('/usuarios')
      .set('Cookie', cookieA)
      .expect(200);
    expect(lista.body).toHaveLength(1);
    expect(lista.body[0].email).toBe(chefeA);
  });
});
