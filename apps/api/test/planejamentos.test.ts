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

describe('Planejamentos', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string;

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
    cookie = await autenticarComoOrgAdmin(prisma);
  });

  it('creates a planejamento and computes custoEstimado from insumo dose and talhao area', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: futura,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
      })
      .expect(201);

    // custoEstimado = 0.35 l/ha * 2000 ha * R$100/l = R$70.000,00
    expect(response.body.custoEstimado).toBe('70000.00');
    expect(response.body.status).toBe('PLANEJADO');
    expect(response.body.insumos).toHaveLength(1);
  });

  it('marks a planejamento as ATRASADO when dataPrevista has passed without execução', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    const passada = new Date(Date.now() - 86400000).toISOString();

    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: passada,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    const got = await request(app.getHttpServer())
      .get(`/planejamentos/${response.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(got.body.status).toBe('ATRASADO');
  });

  it('rejects dosePorHa above the maximum', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 10_001 }],
      })
      .expect(400);
  });

  it('rejects when the computed custoEstimado would exceed the storable limit', async () => {
    // Cada campo individualmente dentro do próprio @Max, mas o produto
    // estoura o limite de custoEstimado calculado (ver limite-custo.ts).
    const propriedade = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Gigante', areaHa: 1_000_000 })
      .expect(201);
    const talhaoGigante = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.body.id}/talhoes`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão Gigante', areaHa: 1_000_000 })
      .expect(201);
    const insumoCaro = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({
        nome: 'Insumo Caríssimo',
        unidade: 'litro',
        precoUnitarioAtual: 1_000_000,
      })
      .expect(201);
    const { safra, procedimento } = await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhaoGigante.body.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        // 1 * 1.000.000 ha * R$1.000.000/l = R$1.000.000.000.000 (acima do limite)
        insumos: [{ insumoId: insumoCaro.body.id, dosePorHa: 1 }],
      })
      .expect(400);
  });

  it('rejects planejamento referencing an unknown talhao', async () => {
    const { safra, procedimento, insumo } = await criarFixturesAgricolas(
      app,
      cookie,
    );
    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: 'nao-existe',
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(404);
  });

  it('rejects dataPrevista outside the safra period', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    // safra de fixtures começa em 2025-06-01; qualquer data antes disso
    // está fora do período independente de quando o teste rodar.
    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: '2024-01-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(400);
  });

  it('keeps custoEstimado and precoUnitarioSnapshot unchanged after the insumo price changes', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);

    const response = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.35 }],
      })
      .expect(201);
    expect(response.body.custoEstimado).toBe('70000.00');
    expect(response.body.insumos[0].precoUnitarioSnapshot).toBe('100.0000');

    await request(app.getHttpServer())
      .patch(`/insumos/${insumo.id}`)
      .set('Cookie', cookie)
      .send({ precoUnitarioAtual: 999 })
      .expect(200);

    const got = await request(app.getHttpServer())
      .get(`/planejamentos/${response.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(got.body.custoEstimado).toBe('70000.00');
    expect(got.body.insumos[0].precoUnitarioSnapshot).toBe('100.0000');
  });

  it('filters planejamentos by safraId and talhaoId', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    const found = await request(app.getHttpServer())
      .get(`/planejamentos?safraId=${safra.id}&talhaoId=${talhao.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(found.body).toHaveLength(1);

    const notFound = await request(app.getHttpServer())
      .get(`/planejamentos?safraId=${safra.id}&talhaoId=outro-talhao`)
      .set('Cookie', cookie)
      .expect(200);
    expect(notFound.body).toHaveLength(0);
  });
});
