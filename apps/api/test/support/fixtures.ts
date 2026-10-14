import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

export async function criarFixturesAgricolas(app: INestApplication) {
  const propriedade = await request(app.getHttpServer())
    .post('/propriedades')
    .send({ nome: 'Fazenda Esperança', areaHa: 10000 })
    .expect(201);

  const talhao = await request(app.getHttpServer())
    .post(`/propriedades/${propriedade.body.id}/talhoes`)
    .send({ nome: 'Talhão 1', areaHa: 2000 })
    .expect(201);

  const safra = await request(app.getHttpServer())
    .post('/safras')
    .send({
      nome: 'Colheitas 25/26 Soja',
      cultura: 'Soja',
      // Janela larga de propósito: cobre "hoje" com folga nos testes de
      // Planejamento/Execução (que usam `new Date()` e +-1 dia), independente
      // de quando este plano for de fato executado.
      dataInicio: '2025-06-01T00:00:00.000Z',
      dataFim: '2030-01-01T00:00:00.000Z',
    })
    .expect(201);

  const procedimento = await request(app.getHttpServer())
    .post('/procedimentos')
    .send({ nome: '1ª Aplicação de Fungicida', tipo: 'APLICACAO' })
    .expect(201);

  const procedimentoColheita = await request(app.getHttpServer())
    .post('/procedimentos')
    .send({ nome: 'Colheita', tipo: 'COLHEITA' })
    .expect(201);

  const insumo = await request(app.getHttpServer())
    .post('/insumos')
    .send({ nome: 'Fox Supra', unidade: 'litro', precoUnitarioAtual: 100 })
    .expect(201);

  return {
    talhao: talhao.body,
    safra: safra.body,
    procedimento: procedimento.body,
    procedimentoColheita: procedimentoColheita.body,
    insumo: insumo.body,
  };
}
