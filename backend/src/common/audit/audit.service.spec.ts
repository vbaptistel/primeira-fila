import { describe, it, expect, beforeEach, vi } from "vitest";
import { AuditService } from "./audit.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AuditAction } from "../../generated/prisma/client";

function buildMockPrisma() {
  return {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-001" })
    }
  } as unknown as PrismaService;
}

describe("AuditService", () => {
  let service: AuditService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    service = new AuditService(prisma);
  });

  describe("log", () => {
    it("deve registrar auditoria com PrismaService direto quando tx nao fornecido", async () => {
      await service.log({
        tenantId: "tenant-001",
        actorId: "actor-001",
        action: AuditAction.CHECK_IN,
        resourceType: "ticket",
        resourceId: "ticket-001",
        metadata: { qrCode: "qr-123" }
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          tenantId: "tenant-001",
          actorId: "actor-001",
          action: AuditAction.CHECK_IN,
          resourceType: "ticket",
          resourceId: "ticket-001",
          metadata: { qrCode: "qr-123" }
        }
      });
    });

    it("deve registrar auditoria via TransactionClient quando tx fornecido", async () => {
      const txClient = {
        auditLog: {
          create: vi.fn().mockResolvedValue({ id: "audit-002" })
        }
      };

      await service.log(
        {
          tenantId: "tenant-001",
          actorId: "actor-001",
          action: AuditAction.REFUND_APPROVED,
          resourceType: "refund",
          resourceId: "refund-001"
        },
        txClient as never
      );

      expect(txClient.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-001",
          actorId: "actor-001",
          action: AuditAction.REFUND_APPROVED,
          resourceType: "refund",
          resourceId: "refund-001"
        })
      });
      expect(prisma.auditLog.create).not.toHaveBeenCalled();
    });

    it("deve registrar metadata undefined quando nao fornecida", async () => {
      await service.log({
        tenantId: "tenant-001",
        actorId: "actor-001",
        action: AuditAction.CHECK_IN,
        resourceType: "ticket",
        resourceId: "ticket-001"
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          metadata: undefined
        })
      });
    });
  });
});
