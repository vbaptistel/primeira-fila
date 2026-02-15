-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('SENT', 'FAILED', 'PENDING');

-- CreateTable
CREATE TABLE "email_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "order_id" UUID,
    "to" VARCHAR(180) NOT NULL,
    "subject" VARCHAR(255) NOT NULL,
    "template_name" VARCHAR(80) NOT NULL,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "error_message" VARCHAR(500),
    "resend_message_id" VARCHAR(80),
    "sent_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_logs_tenant_id_status_idx" ON "email_logs"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "email_logs_order_id_idx" ON "email_logs"("order_id");
