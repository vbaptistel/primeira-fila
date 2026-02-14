-- SQL de hold de assentos com TTL (TASK-008).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'SessionHoldStatus'
  ) THEN
    CREATE TYPE "public"."SessionHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONSUMED', 'CANCELLED');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."session_holds" (
  "id" UUID NOT NULL,
  "tenant_id" UUID NOT NULL,
  "session_id" UUID NOT NULL,
  "status" "public"."SessionHoldStatus" NOT NULL DEFAULT 'ACTIVE',
  "expires_at" TIMESTAMPTZ(6) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,

  CONSTRAINT "session_holds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "session_holds_tenant_id_session_id_status_expires_at_idx"
  ON "public"."session_holds" ("tenant_id", "session_id", "status", "expires_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_holds_session_id_fkey'
  ) THEN
    ALTER TABLE "public"."session_holds"
      ADD CONSTRAINT "session_holds_session_id_fkey"
      FOREIGN KEY ("session_id")
      REFERENCES "public"."sessions" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "public"."session_hold_seats" (
  "id" UUID NOT NULL,
  "hold_id" UUID NOT NULL,
  "seat_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "session_hold_seats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "session_hold_seats_hold_id_seat_id_key"
  ON "public"."session_hold_seats" ("hold_id", "seat_id");

CREATE INDEX IF NOT EXISTS "session_hold_seats_seat_id_idx"
  ON "public"."session_hold_seats" ("seat_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_hold_seats_hold_id_fkey'
  ) THEN
    ALTER TABLE "public"."session_hold_seats"
      ADD CONSTRAINT "session_hold_seats_hold_id_fkey"
      FOREIGN KEY ("hold_id")
      REFERENCES "public"."session_holds" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'session_hold_seats_seat_id_fkey'
  ) THEN
    ALTER TABLE "public"."session_hold_seats"
      ADD CONSTRAINT "session_hold_seats_seat_id_fkey"
      FOREIGN KEY ("seat_id")
      REFERENCES "public"."session_seats" ("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
