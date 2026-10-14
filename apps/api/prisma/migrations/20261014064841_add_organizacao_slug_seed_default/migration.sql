-- AlterTable: adiciona a coluna como opcional primeiro, pra não quebrar em
-- cima de uma linha já existente (ex: ambiente de dev com dado de teste).
ALTER TABLE "Organizacao" ADD COLUMN "slug" TEXT;

-- Backfill: qualquer linha pré-existente vira a organização "default".
-- Nunca deve haver mais de uma linha em Organizacao nesta fase (sem auth).
UPDATE "Organizacao" SET "slug" = 'default' WHERE "slug" IS NULL;

-- Agora torna a coluna obrigatória e única.
ALTER TABLE "Organizacao" ALTER COLUMN "slug" SET NOT NULL;
CREATE UNIQUE INDEX "Organizacao_slug_key" ON "Organizacao"("slug");

-- Semeia a organização padrão como dado de infraestrutura (não em
-- request-time). Idempotente: reaplicar esta migration nunca duplica.
INSERT INTO "Organizacao" ("id", "slug", "nome", "createdAt")
VALUES (gen_random_uuid()::text, 'default', 'Organização Padrão', now())
ON CONFLICT ("slug") DO NOTHING;
