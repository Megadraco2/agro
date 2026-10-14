import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import {
  autenticarComoOrgAdmin,
  criarSessaoUsuario,
} from './support/autenticar';
import { criarFixturesAgricolas } from './support/fixtures';

/**
 * Faz login como o admin de sistema bootstrapado UMA vez (chamado em
 * beforeAll). POST /admin/auth/login tem rate limit de 5 req/60s por app —
 * logar a cada teste estouraria esse orçamento assim que o arquivo tivesse
 * mais de 5 testes, com um 429 que nada tem a ver com o que está sendo
 * testado. limparBanco() não toca em AdminSistema/SessaoAdminSistema, então
 * o cookie continua válido entre os testes.
 */
async function loginAdminSistema(app: INestApplication): Promise<string> {
  const loginAdmin = await request(app.getHttpServer())
    .post('/admin/auth/login')
    .send({
      email: process.env.ADMIN_BOOTSTRAP_EMAIL,
      senha: process.env.ADMIN_BOOTSTRAP_PASSWORD,
    })
    .expect(200);
  return loginAdmin.headers['set-cookie']![0] as string;
}

/**
 * Cria a Org B pela rota real do admin de sistema e devolve um cookie de
 * sessão do ORG_ADMIN dela. A sessão é criada direto via Prisma (mesmo
 * formato que o login grava) em vez de POST /auth/login pelo mesmo motivo
 * de rate limit acima: com um login por teste, este arquivo estouraria o
 * limite de 5/60s. O fluxo HTTP de login em si é coberto por auth.test.ts.
 */
async function criarOutraOrganizacaoAutenticada(
  app: INestApplication,
  prisma: PrismaService,
  cookieAdmin: string,
): Promise<string> {
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

  const usuario = await prisma.usuario.findUniqueOrThrow({ where: { email } });
  return criarSessaoUsuario(prisma, usuario.id);
}

describe('Isolamento entre organizações', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookieOrgA: string;
  let cookieOrgB: string;
  let cookieAdmin: string;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    configureApp(app, 'http://localhost:3000');
    prisma = module.get(PrismaService);
    await app.init();
    cookieAdmin = await loginAdminSistema(app);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await limparBanco(prisma);
    cookieOrgA = await autenticarComoOrgAdmin(prisma);
    cookieOrgB = await criarOutraOrganizacaoAutenticada(
      app,
      prisma,
      cookieAdmin,
    );
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

  it('returns 404 deleting a Propriedade from another organization', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);
    const propriedadeId = talhao.propriedadeId;

    await request(app.getHttpServer())
      .delete(`/propriedades/${propriedadeId}`)
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

  it('returns 404 deleting a Talhão from another organization', async () => {
    const { talhao } = await criarFixturesAgricolas(app, cookieOrgA);

    await request(app.getHttpServer())
      .delete(`/talhoes/${talhao.id}`)
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

  it('returns 404 creating a Planejamento that references only a Procedimento from another organization', async () => {
    const { procedimento: procedimentoOrgA } = await criarFixturesAgricolas(
      app,
      cookieOrgA,
    );
    const {
      safra: safraOrgB,
      talhao: talhaoOrgB,
      insumo: insumoOrgB,
    } = await criarFixturesAgricolas(app, cookieOrgB);

    const resposta = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookieOrgB)
      .send({
        safraId: safraOrgB.id,
        talhaoId: talhaoOrgB.id,
        procedimentoId: procedimentoOrgA.id, // pertence à Org A
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumoOrgB.id, dosePorHa: 0.5 }],
      })
      .expect(404);
    expect(resposta.body.message).toBe('Procedimento não encontrado');
  });

  it('does not list Procedimentos from another organization', async () => {
    await criarFixturesAgricolas(app, cookieOrgA);

    const lista = await request(app.getHttpServer())
      .get('/procedimentos')
      .set('Cookie', cookieOrgB)
      .expect(200);
    expect(lista.body).toEqual([]);

    // Controle positivo: a Org A enxerga os próprios procedimentos.
    const listaOrgA = await request(app.getHttpServer())
      .get('/procedimentos')
      .set('Cookie', cookieOrgA)
      .expect(200);
    expect(listaOrgA.body).toHaveLength(2);
  });

  it('returns 404 updating an Insumo from another organization by id', async () => {
    const { insumo: insumoOrgA } = await criarFixturesAgricolas(
      app,
      cookieOrgA,
    );

    await request(app.getHttpServer())
      .patch(`/insumos/${insumoOrgA.id}`)
      .set('Cookie', cookieOrgB)
      .send({ precoUnitarioAtual: 1 })
      .expect(404);

    const lista = await request(app.getHttpServer())
      .get('/insumos')
      .set('Cookie', cookieOrgA)
      .expect(200);
    expect(lista.body[0].precoUnitarioAtual).toBe(
      insumoOrgA.precoUnitarioAtual,
    );
  });

  it('returns 404 creating an Execucao that references only a Planejamento from another organization', async () => {
    const orgA = await criarFixturesAgricolas(app, cookieOrgA);
    const planejamentoOrgA = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookieOrgA)
      .send({
        safraId: orgA.safra.id,
        talhaoId: orgA.talhao.id,
        procedimentoId: orgA.procedimento.id,
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: orgA.insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);
    const orgB = await criarFixturesAgricolas(app, cookieOrgB);

    const resposta = await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookieOrgB)
      .send({
        safraId: orgB.safra.id,
        talhaoId: orgB.talhao.id,
        procedimentoId: orgB.procedimento.id,
        planejamentoItemId: planejamentoOrgA.body.id, // pertence à Org A
        data: new Date().toISOString(),
        insumos: [{ insumoId: orgB.insumo.id, quantidade: 1 }],
      })
      .expect(404);
    expect(resposta.body.message).toBe('Planejamento não encontrado');
  });

  it('does not list Execucoes from another organization, even filtering by its ids', async () => {
    const orgA = await criarFixturesAgricolas(app, cookieOrgA);
    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookieOrgA)
      .send({
        safraId: orgA.safra.id,
        talhaoId: orgA.talhao.id,
        procedimentoId: orgA.procedimento.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: orgA.insumo.id, quantidade: 1 }],
      })
      .expect(201);

    const lista = await request(app.getHttpServer())
      .get(`/execucoes?safraId=${orgA.safra.id}&talhaoId=${orgA.talhao.id}`)
      .set('Cookie', cookieOrgB)
      .expect(200);
    expect(lista.body).toEqual([]);

    // Controle positivo: a Org A enxerga a própria execução com o mesmo filtro.
    const listaOrgA = await request(app.getHttpServer())
      .get(`/execucoes?safraId=${orgA.safra.id}&talhaoId=${orgA.talhao.id}`)
      .set('Cookie', cookieOrgA)
      .expect(200);
    expect(listaOrgA.body).toHaveLength(1);
  });
});
