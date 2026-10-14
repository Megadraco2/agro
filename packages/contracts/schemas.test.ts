import { describe, expect, it } from 'vitest';
import {
  propriedadeResponseSchema,
  talhaoResponseSchema,
  safraResponseSchema,
  procedimentoResponseSchema,
  insumoResponseSchema,
  planejamentoResponseSchema,
  execucaoResponseSchema,
  compraInsumoResponseSchema,
} from './src';

const agora = new Date().toISOString();

describe('propriedadeResponseSchema', () => {
  const valido = {
    id: 'p1',
    nome: 'Fazenda Esperança',
    areaHa: '10000.00',
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(propriedadeResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      propriedadeResponseSchema.safeParse({
        id: valido.id,
        areaHa: valido.areaHa,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      propriedadeResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('talhaoResponseSchema', () => {
  const valido = {
    id: 't1',
    propriedadeId: 'p1',
    nome: 'Talhão 1',
    areaHa: '2000.00',
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(talhaoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      talhaoResponseSchema.safeParse({
        id: valido.id,
        nome: valido.nome,
        areaHa: valido.areaHa,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      talhaoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('safraResponseSchema', () => {
  const valido = {
    id: 's1',
    nome: 'Colheitas 25/26 Soja',
    cultura: 'Soja',
    dataInicio: agora,
    dataFim: agora,
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(safraResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      safraResponseSchema.safeParse({
        id: valido.id,
        nome: valido.nome,
        dataInicio: valido.dataInicio,
        dataFim: valido.dataFim,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      safraResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('procedimentoResponseSchema', () => {
  const valido = {
    id: 'pr1',
    nome: '1ª Aplicação de Fungicida',
    tipo: 'APLICACAO' as const,
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(procedimentoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita um tipo fora do enum', () => {
    expect(
      procedimentoResponseSchema.safeParse({ ...valido, tipo: 'INVALIDO' })
        .success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      procedimentoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('insumoResponseSchema', () => {
  const valido = {
    id: 'i1',
    nome: 'Fox Supra',
    unidade: 'litro',
    precoUnitarioAtual: '100.0000',
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(insumoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      insumoResponseSchema.safeParse({
        id: valido.id,
        nome: valido.nome,
        precoUnitarioAtual: valido.precoUnitarioAtual,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      insumoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('planejamentoResponseSchema', () => {
  const valido = {
    id: 'pl1',
    safraId: 's1',
    talhaoId: 't1',
    procedimentoId: 'pr1',
    dataPrevista: agora,
    custoEstimado: '70000.00',
    observacao: null,
    status: 'PLANEJADO' as const,
    insumos: [
      {
        insumoId: 'i1',
        dosePorHa: '0.3500',
        precoUnitarioSnapshot: '100.0000',
      },
    ],
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(planejamentoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita um status fora do enum', () => {
    expect(
      planejamentoResponseSchema.safeParse({ ...valido, status: 'INVALIDO' })
        .success,
    ).toBe(false);
  });

  it('rejeita item de insumo aninhado com campo extra', () => {
    expect(
      planejamentoResponseSchema.safeParse({
        ...valido,
        insumos: [{ ...valido.insumos[0], extra: 'não' }],
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra no nível raiz', () => {
    expect(
      planejamentoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('execucaoResponseSchema', () => {
  const valido = {
    id: 'ex1',
    safraId: 's1',
    talhaoId: 't1',
    procedimentoId: 'pr1',
    planejamentoItemId: null,
    data: agora,
    custoTotal: '70000.00',
    operador: null,
    maquina: null,
    quantidadeColhidaSacas: null,
    observacao: null,
    insumos: [
      {
        insumoId: 'i1',
        quantidade: '700.0000',
        precoUnitarioSnapshot: '100.0000',
      },
    ],
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(execucaoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      execucaoResponseSchema.safeParse({
        id: valido.id,
        safraId: valido.safraId,
        talhaoId: valido.talhaoId,
        procedimentoId: valido.procedimentoId,
        planejamentoItemId: valido.planejamentoItemId,
        data: valido.data,
        operador: valido.operador,
        maquina: valido.maquina,
        quantidadeColhidaSacas: valido.quantidadeColhidaSacas,
        observacao: valido.observacao,
        insumos: valido.insumos,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      execucaoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});

describe('compraInsumoResponseSchema', () => {
  const valido = {
    id: 'ci1',
    talhaoId: 't1',
    safraId: 's1',
    insumoId: 'i1',
    data: agora,
    quantidade: '91.0000',
    precoUnitarioSnapshot: '100.0000',
    custoTotal: '9100.00',
    createdAt: agora,
  };

  it('aceita um payload válido', () => {
    expect(compraInsumoResponseSchema.parse(valido)).toEqual(valido);
  });

  it('rejeita payload faltando campo obrigatório', () => {
    expect(
      compraInsumoResponseSchema.safeParse({
        id: valido.id,
        talhaoId: valido.talhaoId,
        safraId: valido.safraId,
        insumoId: valido.insumoId,
        data: valido.data,
        precoUnitarioSnapshot: valido.precoUnitarioSnapshot,
        custoTotal: valido.custoTotal,
        createdAt: valido.createdAt,
      }).success,
    ).toBe(false);
  });

  it('rejeita payload com campo extra', () => {
    expect(
      compraInsumoResponseSchema.safeParse({ ...valido, extra: 'não' }).success,
    ).toBe(false);
  });
});
