-- SQL de mapa de assentos por sessão (TASK-007).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'SessionSeatStatus'
  ) THEN
    CREATE TYPE "public"."SessionSeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'SOLD', 'BLOCKED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."session_seats" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "sector_code" VARCHAR(32) NOT NULL,
  "row_label" VARCHAR(16) NOT NULL,
  "seat_number" INTEGER NOT NULL,
  "status" "public"."SessionSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "session_seats_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_seats_tenant_id_session_id_status_idx"
  ON "public"."session_seats" ("tenant_id", "session_id", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "session_seats_session_id_sector_code_row_label_seat_number_key"
  ON "public"."session_seats" ("session_id", "sector_code", "row_label", "seat_number");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_seats_session_id_fkey'
  ) THEN
    ALTER TABLE "public"."session_seats"
      ADD CONSTRAINT "session_seats_session_id_fkey"
      FOREIGN KEY ("session_id")
      REFERENCES "public"."sessions" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
