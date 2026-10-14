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

describe('Execuções', () => {
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

  it('creates an execução linked to a planejamento, computes custoTotal, and flips the planejamento status', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
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

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        planejamentoItemId: planejamento.body.id,
        data: new Date().toISOString(),
        operador: 'José Dias Nunes',
        maquina: 'Drone Pulverizador DJI Agras T50',
        insumos: [{ insumoId: insumo.id, quantidade: 700 }],
      })
      .expect(201);

    // custoTotal = 700 l * R$100/l = R$70.000,00
    expect(execucao.body.custoTotal).toBe('70000.00');
    expect(execucao.body.planejamentoItemId).toBe(planejamento.body.id);

    const planejamentoAtualizado = await request(app.getHttpServer())
      .get(`/planejamentos/${planejamento.body.id}`)
      .set('Cookie', cookie)
      .expect(200);
    expect(planejamentoAtualizado.body.status).toBe('EXECUTADO');
  });

  it('accepts quantidadeColhidaSacas only for procedimentos do tipo COLHEITA', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        quantidadeColhidaSacas: 500,
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(400);

    const colheita = await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimentoColheita.id,
        data: new Date().toISOString(),
        quantidadeColhidaSacas: 500,
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(201);
    expect(colheita.body.quantidadeColhidaSacas).toBe('500.00');
  });

  it('rejects quantidade above the maximum', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 10_000_001 }],
      })
      .expect(400);
  });

  it('rejects quantidadeColhidaSacas above the maximum', async () => {
    const { talhao, safra, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app, cookie);
    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimentoColheita.id,
        data: new Date().toISOString(),
        quantidadeColhidaSacas: 10_000_001,
        insumos: [{ insumoId: insumo.id, quantidade: 1 }],
      })
      .expect(400);
  });

  it('rejects when the computed custoTotal would exceed the storable limit', async () => {
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
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhaoGigante.body.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        // 1.000.000 l * R$1.000.000/l = R$1.000.000.000.000 (acima do limite)
        insumos: [{ insumoId: insumoCaro.body.id, quantidade: 1_000_000 }],
      })
      .expect(400);
  });

  it('rejects execução whose safra/talhao/procedimento diverge from the linked planejamento', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app, cookie);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: futura,
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.1 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimentoColheita.id,
        planejamentoItemId: planejamento.body.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 1 }],
      })
      .expect(400);
  });

  it('rejects data outside the safra period', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);
    // safra de fixtures começa em 2025-06-01; qualquer data antes disso
    // está fora do período independente de quando o teste rodar.
    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: '2024-01-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, quantidade: 1 }],
      })
      .expect(400);
  });

  it('creates a standalone execução without a planejamento', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(201);
    expect(execucao.body.planejamentoItemId).toBeNull();
  });

  it('keeps custoTotal and precoUnitarioSnapshot unchanged after the insumo price changes', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: new Date().toISOString(),
        insumos: [{ insumoId: insumo.id, quantidade: 700 }],
      })
      .expect(201);
    expect(execucao.body.custoTotal).toBe('70000.00');
    expect(execucao.body.insumos[0].precoUnitarioSnapshot).toBe('100.0000');

    await request(app.getHttpServer())
      .patch(`/insumos/${insumo.id}`)
      .set('Cookie', cookie)
      .send({ precoUnitarioAtual: 999 })
      .expect(200);

    // Execução não tem GET por id — confirma via a listagem filtrada.
    const list = await request(app.getHttpServer())
      .get(`/execucoes?safraId=${safra.id}&talhaoId=${talhao.id}`)
      .set('Cookie', cookie)
      .expect(200);
    const encontrada = list.body.find(
      (item: { id: string }) => item.id === execucao.body.id,
    );
    expect(encontrada.custoTotal).toBe('70000.00');
    expect(encontrada.insumos[0].precoUnitarioSnapshot).toBe('100.0000');
  });
});
