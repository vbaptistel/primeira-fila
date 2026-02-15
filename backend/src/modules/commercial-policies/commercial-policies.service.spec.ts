import { describe, it, expect, beforeEach, vi } from "vitest";
import { BadRequestException, ConflictException } from "@nestjs/common";
import { CommercialPoliciesService } from "./commercial-policies.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

function buildMockPolicy(overrides?: Partial<{
  id: string;
  tenantId: string;
  version: string;
  isPlatformDefault: boolean;
  serviceFeePercentBps: number;
  serviceFeeFixedCents: number;
  currencyCode: string;
  timezone: string;
  effectiveFrom: Date;
  createdAt: Date;
  updatedAt: Date;
}>) {
  const now = new Date();
  return {
    id: overrides?.id ?? "policy-001",
    tenantId: overrides?.tenantId ?? "tenant-001",
    version: overrides?.version ?? "platform_default_v1",
    isPlatformDefault: overrides?.isPlatformDefault ?? true,
    serviceFeePercentBps: overrides?.serviceFeePercentBps ?? 1000,
    serviceFeeFixedCents: overrides?.serviceFeeFixedCents ?? 200,
    currencyCode: overrides?.currencyCode ?? "BRL",
    timezone: overrides?.timezone ?? "America/Sao_Paulo",
    effectiveFrom: overrides?.effectiveFrom ?? now,
    createdAt: overrides?.createdAt ?? now,
    updatedAt: overrides?.updatedAt ?? now
  };
}

function buildMockPrisma() {
  return {
    commercialPolicy: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn()
    }
  } as unknown as PrismaService;
}

describe("CommercialPoliciesService", () => {
  let service: CommercialPoliciesService;
  let prisma: PrismaService;

  beforeEach(() => {
    prisma = buildMockPrisma();
    service = new CommercialPoliciesService(prisma);
  });

  describe("ensureDefaultPolicy", () => {
    it("deve retornar politica existente se ja existe", async () => {
      const existing = buildMockPolicy();
      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(existing as never);

      const result = await service.ensureDefaultPolicy("tenant-001");

      expect(result).toEqual(existing);
      expect(prisma.commercialPolicy.create).not.toHaveBeenCalled();
    });

    it("deve criar politica default quando nao existe", async () => {
      const created = buildMockPolicy();
      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.commercialPolicy.create).mockResolvedValue(created as never);

      const result = await service.ensureDefaultPolicy("tenant-001");

      expect(result).toEqual(created);
      expect(prisma.commercialPolicy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-001",
          version: "platform_default_v1",
          isPlatformDefault: true,
          serviceFeePercentBps: 1000,
          serviceFeeFixedCents: 200,
          currencyCode: "BRL",
          timezone: "America/Sao_Paulo"
        })
      });
    });

    it("deve tratar P2002 (race condition) e retornar politica existente", async () => {
      const existing = buildMockPolicy();
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";

      vi.mocked(prisma.commercialPolicy.findUnique)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(existing as never);
      vi.mocked(prisma.commercialPolicy.create).mockRejectedValue(prismaError);

      const result = await service.ensureDefaultPolicy("tenant-001");

      expect(result).toEqual(existing);
    });

    it("deve lancar ConflictException quando P2002 e politica nao encontrada no retry", async () => {
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.commercialPolicy.create).mockRejectedValue(prismaError);

      await expect(service.ensureDefaultPolicy("tenant-001")).rejects.toThrow(
        ConflictException
      );
      await expect(service.ensureDefaultPolicy("tenant-001")).rejects.toThrow(
        "Falha ao garantir politica default do tenant."
      );
    });

    it("deve propagar erro nao-P2002 ao criar politica default", async () => {
      const genericError = new Error("Connection failed");

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.commercialPolicy.create).mockRejectedValue(genericError);

      await expect(service.ensureDefaultPolicy("tenant-001")).rejects.toThrow(
        "Connection failed"
      );
    });
  });

  describe("getActivePolicy", () => {
    it("deve retornar politica custom se effectiveFrom <= now", async () => {
      const customPolicy = buildMockPolicy({
        id: "policy-custom",
        version: "custom_v1",
        isPlatformDefault: false,
        effectiveFrom: new Date("2026-01-01T00:00:00Z")
      });
      vi.mocked(prisma.commercialPolicy.findFirst).mockResolvedValue(customPolicy as never);

      const result = await service.getActivePolicy("tenant-001");

      expect(result).toEqual(customPolicy);
    });

    it("deve retornar politica default quando nao ha custom vigente", async () => {
      const defaultPolicy = buildMockPolicy();
      vi.mocked(prisma.commercialPolicy.findFirst).mockResolvedValue(null);
      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);

      const result = await service.getActivePolicy("tenant-001");

      expect(result).toEqual(defaultPolicy);
    });
  });

  describe("getTenantCommercialPolicy", () => {
    it("deve retornar output formatado com serviceFeePercent convertido de bps", async () => {
      const policy = buildMockPolicy({
        serviceFeePercentBps: 1500,
        serviceFeeFixedCents: 300
      });
      vi.mocked(prisma.commercialPolicy.findFirst).mockResolvedValue(policy as never);

      const result = await service.getTenantCommercialPolicy("tenant-001");

      expect(result.serviceFeePercent).toBe(15);
      expect(result.serviceFeeFixedCents).toBe(300);
      expect(result.version).toBe("platform_default_v1");
      expect(result.id).toBe("policy-001");
    });
  });

  describe("createPolicyVersion", () => {
    it("deve criar versao custom com sucesso", async () => {
      const defaultPolicy = buildMockPolicy();
      const createdPolicy = buildMockPolicy({
        id: "policy-custom",
        version: "promo_v1",
        isPlatformDefault: false,
        serviceFeePercentBps: 500,
        serviceFeeFixedCents: 100
      });

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);
      vi.mocked(prisma.commercialPolicy.create).mockResolvedValue(createdPolicy as never);

      const result = await service.createPolicyVersion("tenant-001", {
        version: "promo_v1",
        serviceFeePercent: 5,
        serviceFeeFixedCents: 100
      });

      expect(result.version).toBe("promo_v1");
      expect(result.serviceFeePercent).toBe(5);
    });

    it("deve rejeitar versao com nome reservado platform_default_v1", async () => {
      await expect(
        service.createPolicyVersion("tenant-001", {
          version: "platform_default_v1",
          serviceFeePercent: 10,
          serviceFeeFixedCents: 200
        })
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.createPolicyVersion("tenant-001", {
          version: "platform_default_v1",
          serviceFeePercent: 10,
          serviceFeeFixedCents: 200
        })
      ).rejects.toThrow("Versao reservada para politica default da plataforma.");
    });

    it("deve tratar P2002 (versao duplicada) com ConflictException", async () => {
      const defaultPolicy = buildMockPolicy();
      const prismaError = new Error("Unique constraint") as Error & { code: string };
      prismaError.code = "P2002";

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);
      vi.mocked(prisma.commercialPolicy.create).mockRejectedValue(prismaError);

      await expect(
        service.createPolicyVersion("tenant-001", {
          version: "promo_v1",
          serviceFeePercent: 5,
          serviceFeeFixedCents: 100
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve garantir default antes de criar custom", async () => {
      const defaultPolicy = buildMockPolicy();
      const createdPolicy = buildMockPolicy({
        id: "policy-custom",
        version: "promo_v1",
        isPlatformDefault: false
      });

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);
      vi.mocked(prisma.commercialPolicy.create).mockResolvedValue(createdPolicy as never);

      await service.createPolicyVersion("tenant-001", {
        version: "promo_v1",
        serviceFeePercent: 5,
        serviceFeeFixedCents: 100
      });

      expect(prisma.commercialPolicy.findUnique).toHaveBeenCalledWith({
        where: {
          tenantId_version: {
            tenantId: "tenant-001",
            version: "platform_default_v1"
          }
        }
      });
    });

    it("deve converter serviceFeePercent para basis points ao criar", async () => {
      const defaultPolicy = buildMockPolicy();
      const createdPolicy = buildMockPolicy({
        id: "policy-custom",
        version: "promo_v1",
        isPlatformDefault: false,
        serviceFeePercentBps: 750
      });

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);
      vi.mocked(prisma.commercialPolicy.create).mockResolvedValue(createdPolicy as never);

      await service.createPolicyVersion("tenant-001", {
        version: "promo_v1",
        serviceFeePercent: 7.5,
        serviceFeeFixedCents: 150
      });

      expect(prisma.commercialPolicy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          serviceFeePercentBps: 750,
          serviceFeeFixedCents: 150
        })
      });
    });

    it("deve usar effectiveFrom fornecido na criacao", async () => {
      const defaultPolicy = buildMockPolicy();
      const createdPolicy = buildMockPolicy({
        id: "policy-custom",
        version: "future_v1",
        isPlatformDefault: false,
        effectiveFrom: new Date("2026-07-01T00:00:00Z")
      });

      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);
      vi.mocked(prisma.commercialPolicy.create).mockResolvedValue(createdPolicy as never);

      await service.createPolicyVersion("tenant-001", {
        version: "future_v1",
        serviceFeePercent: 5,
        serviceFeeFixedCents: 100,
        effectiveFrom: "2026-07-01T00:00:00Z"
      });

      expect(prisma.commercialPolicy.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          effectiveFrom: new Date("2026-07-01T00:00:00Z")
        })
      });
    });

    it("deve lancar BadRequestException para effectiveFrom invalido", async () => {
      const defaultPolicy = buildMockPolicy();
      vi.mocked(prisma.commercialPolicy.findUnique).mockResolvedValue(defaultPolicy as never);

      await expect(
        service.createPolicyVersion("tenant-001", {
          version: "bad_date_v1",
          serviceFeePercent: 5,
          serviceFeeFixedCents: 100,
          effectiveFrom: "data-invalida"
        })
      ).rejects.toThrow(BadRequestException);
    });
  });
});
