-- AlterTable
ALTER TABLE "tenants" ADD COLUMN     "max_users" INTEGER;

-- CreateTable
CREATE TABLE "tenant_members" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "auth_user_id" UUID NOT NULL,
    "role" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_members_tenant_id_idx" ON "tenant_members"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_members_tenant_id_auth_user_id_key" ON "tenant_members"("tenant_id", "auth_user_id");

-- AddForeignKey
ALTER TABLE "tenant_members" ADD CONSTRAINT "tenant_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
