-- SQL de pedidos com idempotencia (TASK-009).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'OrderStatus'
  ) THEN
    CREATE TYPE "public"."OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."orders" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "hold_id" UUID NOT NULL,
  "idempotency_key" VARCHAR(64) NOT NULL,
  "request_hash" VARCHAR(64) NOT NULL,
  "status" "public"."OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
  "buyer_name" VARCHAR(160) NOT NULL,
  "buyer_email" VARCHAR(180) NOT NULL,
  "buyer_document" VARCHAR(32),
  "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
  "ticket_subtotal_cents" INTEGER NOT NULL,
  "service_fee_cents" INTEGER NOT NULL,
  "total_amount_cents" INTEGER NOT NULL,
  "commercial_policy_version" VARCHAR(80) NOT NULL DEFAULT 'platform_default_v1',
  "hold_expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "orders_hold_id_key"
  ON "public"."orders" ("hold_id");

CREATE UNIQUE INDEX IF NOT EXISTS "orders_idempotency_key_key"
  ON "public"."orders" ("idempotency_key");

CREATE INDEX IF NOT EXISTS "orders_tenant_id_status_idx"
  ON "public"."orders" ("tenant_id", "status");

CREATE INDEX IF NOT EXISTS "orders_session_id_status_idx"
  ON "public"."orders" ("session_id", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_session_id_fkey'
  ) THEN
    ALTER TABLE "public"."orders"
      ADD CONSTRAINT "orders_session_id_fkey"
      FOREIGN KEY ("session_id")
      REFERENCES "public"."sessions" ("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_hold_id_fkey'
  ) THEN
    ALTER TABLE "public"."orders"
      ADD CONSTRAINT "orders_hold_id_fkey"
      FOREIGN KEY ("hold_id")
      REFERENCES "public"."session_holds" ("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."order_items" (
  "id" UUID NOT NULL,
  "order_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "seat_id" UUID NOT NULL,
  "unit_price_cents" INTEGER NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_items_order_id_seat_id_key"
  ON "public"."order_items" ("order_id", "seat_id");

CREATE INDEX IF NOT EXISTS "order_items_session_id_seat_id_idx"
  ON "public"."order_items" ("session_id", "seat_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_order_id_fkey'
  ) THEN
    ALTER TABLE "public"."order_items"
      ADD CONSTRAINT "order_items_order_id_fkey"
      FOREIGN KEY ("order_id")
      REFERENCES "public"."orders" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_session_id_fkey'
  ) THEN
    ALTER TABLE "public"."order_items"
      ADD CONSTRAINT "order_items_session_id_fkey"
      FOREIGN KEY ("session_id")
      REFERENCES "public"."sessions" ("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_seat_id_fkey'
  ) THEN
    ALTER TABLE "public"."order_items"
      ADD CONSTRAINT "order_items_seat_id_fkey"
      FOREIGN KEY ("seat_id")
      REFERENCES "public"."session_seats" ("id")
      ON DELETE RESTRICT
      ON UPDATE CASCADE;
  END IF;
END
$$;
