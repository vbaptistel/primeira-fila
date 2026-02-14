-- SQL inicial do dominio de catalogo (TASK-006).
-- Entidades: events, event_days, sessions.

CREATE SCHEMA IF NOT EXISTS "public";

CREATE TYPE "public"."EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');
CREATE TYPE "public"."EventDayStatus" AS ENUM ('ACTIVE', 'CANCELLED');
CREATE TYPE "public"."SessionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

CREATE TABLE "public"."events" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "slug" VARCHAR(180) NOT NULL,
  "description" TEXT,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  "status" "public"."EventStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."event_days" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "date" DATE NOT NULL,
  "status" "public"."EventDayStatus" NOT NULL DEFAULT 'ACTIVE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "event_days_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "public"."sessions" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "event_id" UUID NOT NULL,
  "event_day_id" UUID NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "starts_at" TIMESTAMPTZ(6) NOT NULL,
  "ends_at" TIMESTAMPTZ(6) NOT NULL,
  "sales_starts_at" TIMESTAMPTZ(6),
  "sales_ends_at" TIMESTAMPTZ(6),
  "price_cents" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "capacity" INTEGER NOT NULL,
  "status" "public"."SessionStatus" NOT NULL DEFAULT 'DRAFT',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "events_tenant_id_status_idx" ON "public"."events" ("tenant_id", "status");
CREATE UNIQUE INDEX "events_tenant_id_slug_key" ON "public"."events" ("tenant_id", "slug");

CREATE INDEX "event_days_tenant_id_event_id_idx" ON "public"."event_days" ("tenant_id", "event_id");
CREATE UNIQUE INDEX "event_days_event_id_date_key" ON "public"."event_days" ("event_id", "date");
CREATE UNIQUE INDEX "event_days_id_event_id_key" ON "public"."event_days" ("id", "event_id");

CREATE INDEX "sessions_tenant_id_status_idx" ON "public"."sessions" ("tenant_id", "status");
CREATE INDEX "sessions_event_id_event_day_id_idx" ON "public"."sessions" ("event_id", "event_day_id");
CREATE UNIQUE INDEX "sessions_event_day_id_starts_at_key" ON "public"."sessions" ("event_day_id", "starts_at");

ALTER TABLE "public"."event_days"
  ADD CONSTRAINT "event_days_event_id_fkey"
  FOREIGN KEY ("event_id")
  REFERENCES "public"."events" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_event_id_fkey"
  FOREIGN KEY ("event_id")
  REFERENCES "public"."events" ("id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;

ALTER TABLE "public"."sessions"
  ADD CONSTRAINT "sessions_event_day_id_event_id_fkey"
  FOREIGN KEY ("event_day_id", "event_id")
  REFERENCES "public"."event_days" ("id", "event_id")
  ON DELETE CASCADE
  ON UPDATE CASCADE;
