-- CreateEnum
CREATE TYPE "TipoProcedimento" AS ENUM ('APLICACAO', 'PLANTIO', 'COLHEITA', 'IRRIGACAO', 'OUTRO');

-- CreateTable
CREATE TABLE "Organizacao" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organizacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Propriedade" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Propriedade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Talhao" (
    "id" TEXT NOT NULL,
    "propriedadeId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "areaHa" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Talhao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Safra" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cultura" TEXT NOT NULL,
    "dataInicio" TIMESTAMP(3) NOT NULL,
    "dataFim" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Safra_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Procedimento" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "tipo" "TipoProcedimento" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Procedimento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Insumo" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "unidade" TEXT NOT NULL,
    "precoUnitarioAtual" DECIMAL(12,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Insumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanejamentoItem" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "safraId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "dataPrevista" TIMESTAMP(3) NOT NULL,
    "custoEstimado" DECIMAL(14,2) NOT NULL,
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PlanejamentoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlanejamentoInsumo" (
    "id" TEXT NOT NULL,
    "planejamentoItemId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "dosePorHa" DECIMAL(12,4) NOT NULL,
    "precoUnitarioSnapshot" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "PlanejamentoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecucaoItem" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "safraId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "procedimentoId" TEXT NOT NULL,
    "planejamentoItemId" TEXT,
    "data" TIMESTAMP(3) NOT NULL,
    "custoTotal" DECIMAL(14,2) NOT NULL,
    "operador" TEXT,
    "maquina" TEXT,
    "quantidadeColhidaSacas" DECIMAL(12,2),
    "observacao" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExecucaoItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExecucaoInsumo" (
    "id" TEXT NOT NULL,
    "execucaoItemId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "precoUnitarioSnapshot" DECIMAL(12,4) NOT NULL,

    CONSTRAINT "ExecucaoInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompraInsumo" (
    "id" TEXT NOT NULL,
    "organizacaoId" TEXT NOT NULL,
    "talhaoId" TEXT NOT NULL,
    "safraId" TEXT NOT NULL,
    "insumoId" TEXT NOT NULL,
    "data" TIMESTAMP(3) NOT NULL,
    "quantidade" DECIMAL(12,4) NOT NULL,
    "precoUnitarioSnapshot" DECIMAL(12,4) NOT NULL,
    "custoTotal" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompraInsumo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Propriedade_organizacaoId_idx" ON "Propriedade"("organizacaoId");

-- CreateIndex
CREATE INDEX "Talhao_propriedadeId_idx" ON "Talhao"("propriedadeId");

-- CreateIndex
CREATE INDEX "Safra_organizacaoId_idx" ON "Safra"("organizacaoId");

-- CreateIndex
CREATE INDEX "Procedimento_organizacaoId_idx" ON "Procedimento"("organizacaoId");

-- CreateIndex
CREATE INDEX "Insumo_organizacaoId_idx" ON "Insumo"("organizacaoId");

-- CreateIndex
CREATE INDEX "PlanejamentoItem_organizacaoId_idx" ON "PlanejamentoItem"("organizacaoId");

-- CreateIndex
CREATE INDEX "PlanejamentoItem_safraId_idx" ON "PlanejamentoItem"("safraId");

-- CreateIndex
CREATE INDEX "PlanejamentoItem_talhaoId_idx" ON "PlanejamentoItem"("talhaoId");

-- CreateIndex
CREATE INDEX "PlanejamentoInsumo_planejamentoItemId_idx" ON "PlanejamentoInsumo"("planejamentoItemId");

-- CreateIndex
CREATE INDEX "ExecucaoItem_organizacaoId_idx" ON "ExecucaoItem"("organizacaoId");

-- CreateIndex
CREATE INDEX "ExecucaoItem_safraId_idx" ON "ExecucaoItem"("safraId");

-- CreateIndex
CREATE INDEX "ExecucaoItem_talhaoId_idx" ON "ExecucaoItem"("talhaoId");

-- CreateIndex
CREATE INDEX "ExecucaoItem_planejamentoItemId_idx" ON "ExecucaoItem"("planejamentoItemId");

-- CreateIndex
CREATE INDEX "ExecucaoInsumo_execucaoItemId_idx" ON "ExecucaoInsumo"("execucaoItemId");

-- CreateIndex
CREATE INDEX "CompraInsumo_organizacaoId_idx" ON "CompraInsumo"("organizacaoId");

-- CreateIndex
CREATE INDEX "CompraInsumo_talhaoId_idx" ON "CompraInsumo"("talhaoId");

-- CreateIndex
CREATE INDEX "CompraInsumo_safraId_idx" ON "CompraInsumo"("safraId");

-- AddForeignKey
ALTER TABLE "Propriedade" ADD CONSTRAINT "Propriedade_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Talhao" ADD CONSTRAINT "Talhao_propriedadeId_fkey" FOREIGN KEY ("propriedadeId") REFERENCES "Propriedade"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Safra" ADD CONSTRAINT "Safra_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Procedimento" ADD CONSTRAINT "Procedimento_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Insumo" ADD CONSTRAINT "Insumo_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoInsumo" ADD CONSTRAINT "PlanejamentoInsumo_planejamentoItemId_fkey" FOREIGN KEY ("planejamentoItemId") REFERENCES "PlanejamentoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlanejamentoInsumo" ADD CONSTRAINT "PlanejamentoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_planejamentoItemId_fkey" FOREIGN KEY ("planejamentoItemId") REFERENCES "PlanejamentoItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoInsumo" ADD CONSTRAINT "ExecucaoInsumo_execucaoItemId_fkey" FOREIGN KEY ("execucaoItemId") REFERENCES "ExecucaoItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExecucaoInsumo" ADD CONSTRAINT "ExecucaoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_organizacaoId_fkey" FOREIGN KEY ("organizacaoId") REFERENCES "Organizacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
