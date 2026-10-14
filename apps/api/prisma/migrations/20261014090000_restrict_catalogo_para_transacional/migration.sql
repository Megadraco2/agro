-- Troca as FKs de entidade de catálogo (Insumo, Procedimento, Safra, Talhão)
-- para entidade transacional (PlanejamentoItem/PlanejamentoInsumo,
-- ExecucaoItem/ExecucaoInsumo, CompraInsumo) de ON DELETE CASCADE para
-- ON DELETE RESTRICT. Sem essa troca, excluir um Insumo/Procedimento/Safra/
-- Talhão apagaria silenciosamente o histórico financeiro que o referencia.
-- FKs de Organizacao e as relações pai-filho internas ao próprio registro
-- transacional (PlanejamentoItem->PlanejamentoInsumo, ExecucaoItem->
-- ExecucaoInsumo) continuam CASCADE — não fazem parte deste achado.

-- PlanejamentoItem
ALTER TABLE "PlanejamentoItem" DROP CONSTRAINT "PlanejamentoItem_safraId_fkey";
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanejamentoItem" DROP CONSTRAINT "PlanejamentoItem_talhaoId_fkey";
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PlanejamentoItem" DROP CONSTRAINT "PlanejamentoItem_procedimentoId_fkey";
ALTER TABLE "PlanejamentoItem" ADD CONSTRAINT "PlanejamentoItem_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- PlanejamentoInsumo
ALTER TABLE "PlanejamentoInsumo" DROP CONSTRAINT "PlanejamentoInsumo_insumoId_fkey";
ALTER TABLE "PlanejamentoInsumo" ADD CONSTRAINT "PlanejamentoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ExecucaoItem
ALTER TABLE "ExecucaoItem" DROP CONSTRAINT "ExecucaoItem_safraId_fkey";
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExecucaoItem" DROP CONSTRAINT "ExecucaoItem_talhaoId_fkey";
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ExecucaoItem" DROP CONSTRAINT "ExecucaoItem_procedimentoId_fkey";
ALTER TABLE "ExecucaoItem" ADD CONSTRAINT "ExecucaoItem_procedimentoId_fkey" FOREIGN KEY ("procedimentoId") REFERENCES "Procedimento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ExecucaoInsumo
ALTER TABLE "ExecucaoInsumo" DROP CONSTRAINT "ExecucaoInsumo_insumoId_fkey";
ALTER TABLE "ExecucaoInsumo" ADD CONSTRAINT "ExecucaoInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CompraInsumo
ALTER TABLE "CompraInsumo" DROP CONSTRAINT "CompraInsumo_talhaoId_fkey";
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_talhaoId_fkey" FOREIGN KEY ("talhaoId") REFERENCES "Talhao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompraInsumo" DROP CONSTRAINT "CompraInsumo_safraId_fkey";
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_safraId_fkey" FOREIGN KEY ("safraId") REFERENCES "Safra"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompraInsumo" DROP CONSTRAINT "CompraInsumo_insumoId_fkey";
ALTER TABLE "CompraInsumo" ADD CONSTRAINT "CompraInsumo_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
