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

describe('Safras', () => {
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

  it('creates and lists a safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);
    expect(created.body).toMatchObject({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
    });

    const list = await request(app.getHttpServer())
      .get('/safras')
      .set('Cookie', cookie)
      .expect(200);
    expect(list.body).toHaveLength(1);
  });

  it('rejects dataFim before dataInicio', async () => {
    await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Safra inválida',
        cultura: 'Soja',
        dataInicio: '2026-06-01T00:00:00.000Z',
        dataFim: '2025-06-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('updates an existing safra', async () => {
    const created = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    const updated = await request(app.getHttpServer())
      .patch(`/safras/${created.body.id}`)
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja (revisada)',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-07-01T00:00:00.000Z',
      })
      .expect(200);
    expect(updated.body.nome).toBe('Colheitas 25/26 Soja (revisada)');
  });

  async function criarContextoParaRegistroVinculado() {
    const propriedade = await request(app.getHttpServer())
      .post('/propriedades')
      .set('Cookie', cookie)
      .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
      .expect(201);
    const talhao = await request(app.getHttpServer())
      .post(`/propriedades/${propriedade.body.id}/talhoes`)
      .set('Cookie', cookie)
      .send({ nome: 'Talhão 1', areaHa: 2000 })
      .expect(201);
    const procedimento = await request(app.getHttpServer())
      .post('/procedimentos')
      .set('Cookie', cookie)
      .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
      .expect(201);
    const insumo = await request(app.getHttpServer())
      .post('/insumos')
      .set('Cookie', cookie)
      .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
      .expect(201);
    return {
      talhao: talhao.body,
      procedimento: procedimento.body,
      insumo: insumo.body,
    };
  }

  it('rejects narrowing dataInicio/dataFim that would exclude an existing planejamento', async () => {
    const { talhao, procedimento, insumo } =
      await criarContextoParaRegistroVinculado();
    const safra = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.body.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: '2025-12-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/safras/${safra.body.id}`)
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        // Estreita o fim pra antes do planejamento de 2025-12-01.
        dataFim: '2025-11-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('rejects narrowing dataInicio/dataFim that would exclude an existing execução', async () => {
    const { talhao, procedimento, insumo } =
      await criarContextoParaRegistroVinculado();
    const safra = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/execucoes')
      .set('Cookie', cookie)
      .send({
        safraId: safra.body.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        data: '2025-12-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, quantidade: 10 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/safras/${safra.body.id}`)
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        // Estreita o início pra depois da execução de 2025-12-01.
        dataInicio: '2026-01-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(400);
  });

  it('allows narrowing dataInicio/dataFim when every existing record stays inside the new window', async () => {
    const { talhao, procedimento, insumo } =
      await criarContextoParaRegistroVinculado();
    const safra = await request(app.getHttpServer())
      .post('/safras')
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        dataInicio: '2025-06-01T00:00:00.000Z',
        dataFim: '2026-06-01T00:00:00.000Z',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.body.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: '2025-12-01T00:00:00.000Z',
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/safras/${safra.body.id}`)
      .set('Cookie', cookie)
      .send({
        nome: 'Colheitas 25/26 Soja',
        cultura: 'Soja',
        // Estreita a janela, mas o planejamento de 2025-12-01 continua dentro.
        dataInicio: '2025-11-01T00:00:00.000Z',
        dataFim: '2026-01-01T00:00:00.000Z',
      })
      .expect(200);
  });

  it('rejects deleting a Safra with Planejamento history', async () => {
    const { talhao, safra, procedimento, insumo } =
      await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .post('/planejamentos')
      .set('Cookie', cookie)
      .send({
        safraId: safra.id,
        talhaoId: talhao.id,
        procedimentoId: procedimento.id,
        dataPrevista: new Date(Date.now() + 86400000).toISOString(),
        insumos: [{ insumoId: insumo.id, dosePorHa: 0.5 }],
      })
      .expect(201);

    await request(app.getHttpServer())
      .delete(`/safras/${safra.id}`)
      .set('Cookie', cookie)
      .expect(400);
  });

  it('deletes a Safra with no history', async () => {
    const { safra } = await criarFixturesAgricolas(app, cookie);

    await request(app.getHttpServer())
      .delete(`/safras/${safra.id}`)
      .set('Cookie', cookie)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/safras/${safra.id}`)
      .set('Cookie', cookie)
      .expect(404);
  });
});
