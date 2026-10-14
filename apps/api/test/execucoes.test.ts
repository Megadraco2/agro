import 'reflect-metadata';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { limparBanco } from './support/limpar-banco';
import { criarFixturesAgricolas } from './support/fixtures';

describe('Execuções', () => {
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

  beforeEach(async () => {
    await limparBanco(prisma);
  });

  it('creates an execução linked to a planejamento, computes custoTotal, and flips the planejamento status', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
      .post('/planejamentos')
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
      .expect(200);
    expect(planejamentoAtualizado.body.status).toBe('EXECUTADO');
  });

  it('accepts quantidadeColhidaSacas only for procedimentos do tipo COLHEITA', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app);

    await request(app.getHttpServer())
      .post('/execucoes')
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

  it('rejects execução whose safra/talhao/procedimento diverge from the linked planejamento', async () => {
    const { talhao, safra, procedimento, procedimentoColheita, insumo } =
      await criarFixturesAgricolas(app);
    const futura = new Date(Date.now() + 86400000).toISOString();

    const planejamento = await request(app.getHttpServer())
      .post('/planejamentos')
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
      await criarFixturesAgricolas(app);
    // safra de fixtures começa em 2025-06-01; qualquer data antes disso
    // está fora do período independente de quando o teste rodar.
    await request(app.getHttpServer())
      .post('/execucoes')
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
      await criarFixturesAgricolas(app);

    const execucao = await request(app.getHttpServer())
      .post('/execucoes')
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
});
