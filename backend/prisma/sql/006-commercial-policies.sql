-- SQL de politicas comerciais por tenant (TASK-016, TASK-017, TASK-058).

CREATE TABLE IF NOT EXISTS "public"."commercial_policies" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "version" VARCHAR(80) NOT NULL,
  "is_platform_default" BOOLEAN NOT NULL DEFAULT FALSE,
  "service_fee_percent_bps" INTEGER NOT NULL,
  "service_fee_fixed_cents" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  "effective_from" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "commercial_policies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "commercial_policies_tenant_id_version_key"
  ON "public"."commercial_policies" ("tenant_id", "version");

CREATE INDEX IF NOT EXISTS "commercial_policies_tenant_id_effective_from_idx"
  ON "public"."commercial_policies" ("tenant_id", "effective_from");
