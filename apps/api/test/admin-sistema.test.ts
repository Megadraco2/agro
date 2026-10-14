import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Admin de sistema', () => {
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

  it('bootstraps exactly one AdminSistema from env vars and never duplicates it', async () => {
    const total = await prisma.adminSistema.count();
    expect(total).toBe(1);
    const admin = await prisma.adminSistema.findUniqueOrThrow({
      where: { email: process.env.ADMIN_BOOTSTRAP_EMAIL },
    });
    expect(admin).toBeTruthy();
  });

  it('logs in with bootstrap credentials and rejects wrong password', async () => {
    await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: 'senha-errada',
      })
      .expect(401);

    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);
    expect(login.headers['set-cookie']?.[0]).toContain('agro_admin_session=');
  });

  it('rejects creating an organization without a valid admin session', async () => {
    await request(app.getHttpServer())
      .post('/admin/organizacoes')
      .send({
        nome: 'Fazenda Teste',
        maxUsuarios: 3,
        adminEmail: 'chefe@fazenda-teste.com',
        adminSenha: 'senha-do-chefe-123',
      })
      .expect(401);
  });

  it('creates an organization with its first ORG_ADMIN user, then lists it', async () => {
    const login = await request(app.getHttpServer())
      .post('/admin/auth/login')
      .send({
        email: process.env.ADMIN_BOOTSTRAP_EMAIL,
        senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
      })
      .expect(200);
    const cookie = login.headers['set-cookie']![0] as string;

    const criada = await request(app.getHttpServer())
      .post('/admin/organizacoes')
      .set('Cookie', cookie)
      .send({
        nome: 'Fazenda Teste',
        maxUsuarios: 3,
        adminEmail: 'chefe@fazenda-teste.com',
        adminSenha: 'senha-do-chefe-123',
      })
      .expect(201);
    expect(criada.body).toMatchObject({
      nome: 'Fazenda Teste',
      maxUsuarios: 3,
      totalUsuarios: 1,
    });

    const lista = await request(app.getHttpServer())
      .get('/admin/organizacoes')
      .set('Cookie', cookie)
      .expect(200);
    expect(
      lista.body.find((o: { id: string }) => o.id === criada.body.id),
    ).toMatchObject({ nome: 'Fazenda Teste' });

    await prisma.usuario.deleteMany({
      where: { email: 'chefe@fazenda-teste.com' },
    });
    await prisma.organizacao.delete({ where: { id: criada.body.id } });
  });
});
