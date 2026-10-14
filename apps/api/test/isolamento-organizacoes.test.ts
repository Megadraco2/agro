import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { autenticarComoOrgAdmin } from './support/autenticar';
import { criarFixturesAgricolas } from './support/fixtures';

async function criarOutraOrganizacaoAutenticada(app: INestApplication) {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  const cookieAdmin = loginAdmin.headers['set-cookie']![0] as string;

  const email = `chefe-outra-org-${Date.now()}@teste.com`;
  await request(app.getHttpServer())
    .post('/admin/organizacoes')
    .set('Cookie', cookieAdmin)
    .send({
      nome: `Outra Org ${Date.now()}`,
      maxUsuarios: 2,
      adminEmail: email,
      adminSenha: 'senha-outra-org-123',
    })
    .expect(201);

  const login = await request(app.getHttpServer())
    .post('/auth/login')
    .send({ email, senha: 'senha-outra-org-123' })
    .expect(200);
  return login.headers['set-cookie']![0] as string;
}

describe('Isolamento entre organizações', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookieOrgA: string;
  let cookieOrgB: string;

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
    cookieOrgA = await autenticarComoOrgAdmin(prisma);
    cookieOrgB = await criarOutraOrganizacaoAutenticada(app);
  });

  it('returns 404 reading a Propriedade from another organization by id', async () => {
    const propriedade = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookieOrgA)
      .send({ nome: 'Fazenda da Org A', areaHa: 500 })
      .expect(201);

    await request(app.getHttpServer())
      .get(`/propriedades/${propriedade.body.id}`)
      .set('Cookie', cookieOrgB)
      .expect(404);
  });

  it('returns 404 updating a Safra from another organization by id', async () => {
    const safra = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookieOrgA)
      .send({
        nome: 'Safra da Org A',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/safras/${safra.body.id}`)
      .set('Cookie', cookieOrgB)
      .send({
        nome: 'Tentativa de editar',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(404);
  });

  it('returns 404 reading a Talhao from another organization by id (via relação com Propriedade)', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);

    await request(app.getHttpServer())
      .get(`/talhoes/${talhao.id}`)
      .set('Cookie', cookieOrgB)
      .expect(404);
  });

  it('returns 404 creating a Planejamento that references a Talhao from another organization', async () => {
    const { talhao, procedimento, insumo } = await criarFixturesAgricolas(
      app,
      cookieOrgA,
    );
    const { safra: safraOrgB } = await criarFixturesAgricolas(app, cookieOrgB);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookieOrgB)
      .send({
        safraId: safraOrgB.id,
        talhaoId: talhao.id, // pertence à Org A
        procedimentoId: procedimento.id, // pertence à Org A
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }], // pertence à Org A
      })
      .expect(404);
  });

  it('returns 404 creating a CompraInsumo that references a Safra from another organization', async () => {
    const { talhao: talhaoOrgB, insumo: insumoOrgB } =
      await criarFixturesAgricolas(app, cookieOrgB);
    const { safra: safraOrgA } = await criarFixturesAgricolas(app, cookieOrgA);

    await request(app.getHttpServer())
      .post('/compras-insumo')
      .set('Cookie', cookieOrgB)
      .send({
        talhaoId: talhaoOrgB.id,
        safraId: safraOrgA.id, // pertence à Org A
        insumoId: insumoOrgB.id,
        data: new Date().toISOString(),
        quantidade: 10,
      })
      .expect(404);
  });
});
