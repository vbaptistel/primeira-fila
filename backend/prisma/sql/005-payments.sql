-- SQL de pagamentos com idempotencia e confirmacao sincrona (TASK-010).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'PaymentStatus'
  ) THEN
    CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REFUNDED', 'ERROR');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'PaymentMethod'
  ) THEN
    CREATE TYPE "public"."PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."payments" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "provider" VARCHAR(40) NOT NULL DEFAULT 'mock_gateway',
  "provider_payment_id" VARCHAR(80) NOT NULL,
  "method" "public"."PaymentMethod" NOT NULL,
  "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "amount_cents" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "provider_payload" JSONB,
  "approved_at" TIMESTAMPTZ(6),
  "denied_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "payments_idempotency_key_key"
  ON "public"."payments" ("idempotency_key");

CREATE UNIQUE INDEX IF NOT EXISTS "payments_provider_payment_id_key"
  ON "public"."payments" ("provider_payment_id");

CREATE INDEX IF NOT EXISTS "payments_tenant_id_order_id_status_idx"
  ON "public"."payments" ("tenant_id", "order_id", "status");

CREATE INDEX IF NOT EXISTS "payments_order_id_status_idx"
  ON "public"."payments" ("order_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'payments_order_id_fkey'
  ) THEN
    ALTER TABLE "public"."payments"
      ADD CONSTRAINT "payments_order_id_fkey"
      FOREIGN KEY ("order_id")
      REFERENCES "public"."orders" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
