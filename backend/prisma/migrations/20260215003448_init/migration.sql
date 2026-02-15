-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "EventDayStatus" AS ENUM ('ACTIVE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SessionSeatStatus" AS ENUM ('AVAILABLE', 'HELD', 'SOLD', 'BLOCKED');

-- CreateEnum
CREATE TYPE "SessionHoldStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CONSUMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'DENIED', 'REFUNDED', 'ERROR');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('PIX', 'CREDIT_CARD', 'DEBIT_CARD');

-- CreateEnum
CREATE TYPE "TicketStatus" AS ENUM ('VALID', 'USED', 'CANCELLED');

-- CreateTable
CREATE TABLE "commercial_policies" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "version" VARCHAR(80) NOT NULL,
    "is_platform_default" BOOLEAN NOT NULL DEFAULT false,
    "service_fee_percent_bps" INTEGER NOT NULL,
    "service_fee_fixed_cents" INTEGER NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'BRL',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "commercial_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "slug" VARCHAR(180) NOT NULL,
    "description" TEXT,
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_days" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "status" "EventDayStatus" NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "event_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
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
    "status" "SessionStatus" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_seats" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "sector_code" VARCHAR(32) NOT NULL,
    "row_label" VARCHAR(16) NOT NULL,
    "seat_number" INTEGER NOT NULL,
    "status" "SessionSeatStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_holds" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "status" "SessionHoldStatus" NOT NULL DEFAULT 'ACTIVE',
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "session_holds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_hold_seats" (
    "id" UUID NOT NULL,
    "hold_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "session_hold_seats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "hold_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
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

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "idempotency_key" VARCHAR(64) NOT NULL,
    "request_hash" VARCHAR(64) NOT NULL,
    "provider" VARCHAR(40) NOT NULL DEFAULT 'mock_gateway',
    "provider_payment_id" VARCHAR(80) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "amount_cents" INTEGER NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "provider_payload" JSONB,
    "approved_at" TIMESTAMPTZ(6),
    "denied_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "unit_price_cents" INTEGER NOT NULL,
    "currency_code" VARCHAR(3) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID NOT NULL,
    "order_item_id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "seat_id" UUID NOT NULL,
    "qr_code" VARCHAR(64) NOT NULL,
    "status" "TicketStatus" NOT NULL DEFAULT 'VALID',
    "used_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "commercial_policies_tenant_id_effective_from_idx" ON "commercial_policies"("tenant_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "commercial_policies_tenant_id_version_key" ON "commercial_policies"("tenant_id", "version");

-- CreateIndex
CREATE INDEX "events_tenant_id_status_idx" ON "events"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "events_tenant_id_slug_key" ON "events"("tenant_id", "slug");

-- CreateIndex
CREATE INDEX "event_days_tenant_id_event_id_idx" ON "event_days"("tenant_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_days_event_id_date_key" ON "event_days"("event_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "event_days_id_event_id_key" ON "event_days"("id", "event_id");

-- CreateIndex
CREATE INDEX "sessions_tenant_id_status_idx" ON "sessions"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "sessions_event_id_event_day_id_idx" ON "sessions"("event_id", "event_day_id");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_event_day_id_starts_at_key" ON "sessions"("event_day_id", "starts_at");

-- CreateIndex
CREATE INDEX "session_seats_tenant_id_session_id_status_idx" ON "session_seats"("tenant_id", "session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "session_seats_session_id_sector_code_row_label_seat_number_key" ON "session_seats"("session_id", "sector_code", "row_label", "seat_number");

-- CreateIndex
CREATE INDEX "session_holds_tenant_id_session_id_status_expires_at_idx" ON "session_holds"("tenant_id", "session_id", "status", "expires_at");

-- CreateIndex
CREATE INDEX "session_hold_seats_seat_id_idx" ON "session_hold_seats"("seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "session_hold_seats_hold_id_seat_id_key" ON "session_hold_seats"("hold_id", "seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_hold_id_key" ON "orders"("hold_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders"("idempotency_key");

-- CreateIndex
CREATE INDEX "orders_tenant_id_status_idx" ON "orders"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "orders_session_id_status_idx" ON "orders"("session_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_idempotency_key_key" ON "payments"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "payments_provider_payment_id_key" ON "payments"("provider_payment_id");

-- CreateIndex
CREATE INDEX "payments_tenant_id_order_id_status_idx" ON "payments"("tenant_id", "order_id", "status");

-- CreateIndex
CREATE INDEX "payments_order_id_status_idx" ON "payments"("order_id", "status");

-- CreateIndex
CREATE INDEX "order_items_session_id_seat_id_idx" ON "order_items"("session_id", "seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_items_order_id_seat_id_key" ON "order_items"("order_id", "seat_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_order_item_id_key" ON "tickets"("order_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_qr_code_key" ON "tickets"("qr_code");

-- CreateIndex
CREATE INDEX "tickets_tenant_id_order_id_idx" ON "tickets"("tenant_id", "order_id");

-- CreateIndex
CREATE INDEX "tickets_order_id_status_idx" ON "tickets"("order_id", "status");

-- AddForeignKey
ALTER TABLE "event_days" ADD CONSTRAINT "event_days_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_event_day_id_event_id_fkey" FOREIGN KEY ("event_day_id", "event_id") REFERENCES "event_days"("id", "event_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_seats" ADD CONSTRAINT "session_seats_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_holds" ADD CONSTRAINT "session_holds_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_hold_seats" ADD CONSTRAINT "session_hold_seats_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "session_holds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_hold_seats" ADD CONSTRAINT "session_hold_seats_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "session_seats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_hold_id_fkey" FOREIGN KEY ("hold_id") REFERENCES "session_holds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "session_seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_seat_id_fkey" FOREIGN KEY ("seat_id") REFERENCES "session_seats"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
