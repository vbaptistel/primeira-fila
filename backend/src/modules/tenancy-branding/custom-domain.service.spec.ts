import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { BadRequestException, NotFoundException } from "@nestjs/common";
import { CustomDomainService } from "./custom-domain.service";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

function createMockPrisma() {
  return {
    tenant: {
      update: vi.fn()
    }
  } as unknown as PrismaService;
}

function createMockTenancyBrandingService() {
  return {
    getTenant: vi.fn(),
    invalidateCache: vi.fn()
  } as unknown as TenancyBrandingService;
}

const TENANT_FIXTURE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Acme Eventos",
  slug: "acme-eventos",
  subdomain: "acme",
  customDomain: null as string | null,
  customDomainStatus: null as string | null,
  customDomainVerifiedAt: null as Date | null,
  isActive: true
};

describe("CustomDomainService", () => {
  let service: CustomDomainService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tenancyBranding: ReturnType<typeof createMockTenancyBrandingService>;

  beforeEach(() => {
    // Garantir que variaveis Vercel nao estao setadas nos testes
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_PROJECT_ID;

    prisma = createMockPrisma();
    tenancyBranding = createMockTenancyBrandingService();
    service = new CustomDomainService(
      prisma as unknown as PrismaService,
      tenancyBranding as unknown as TenancyBrandingService
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // --- addDomain ---

  describe("addDomain", () => {
    it("deve adicionar dominio customizado com status PENDING_VERIFICATION", async () => {
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      const result = await service.addDomain(TENANT_FIXTURE.id, "ingressos.acme.com.br");

      expect(result.domain).toBe("ingressos.acme.com.br");
      expect(result.status).toBe("PENDING_VERIFICATION");
      expect(result.dnsInstructions).toBeTruthy();
      expect(result.dnsInstructions!.length).toBeGreaterThan(0);
      expect(result.dnsInstructions![0].type).toBe("CNAME");

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_FIXTURE.id },
        data: {
          customDomain: "ingressos.acme.com.br",
          customDomainStatus: "PENDING_VERIFICATION",
          customDomainVerifiedAt: null
        }
      });
    });

    it("deve rejeitar se tenant ja possui dominio diferente", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "outro-dominio.com"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(tenantWithDomain as never);

      await expect(
        service.addDomain(TENANT_FIXTURE.id, "novo-dominio.com")
      ).rejects.toThrow(BadRequestException);
    });

    it("deve permitir re-adicionar o mesmo dominio", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(tenantWithDomain as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      const result = await service.addDomain(TENANT_FIXTURE.id, "ingressos.acme.com.br");
      expect(result.domain).toBe("ingressos.acme.com.br");
    });
  });

  // --- removeDomain ---

  describe("removeDomain", () => {
    it("deve remover dominio customizado", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(tenantWithDomain as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      await service.removeDomain(TENANT_FIXTURE.id);

      expect(prisma.tenant.update).toHaveBeenCalledWith({
        where: { id: TENANT_FIXTURE.id },
        data: {
          customDomain: null,
          customDomainStatus: null,
          customDomainVerifiedAt: null
        }
      });
    });

    it("deve lancar NotFoundException se nao possui dominio", async () => {
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);

      await expect(service.removeDomain(TENANT_FIXTURE.id)).rejects.toThrow(NotFoundException);
    });
  });

  // --- verifyDomain ---

  describe("verifyDomain", () => {
    it("deve retornar status VERIFIED se ja verificado", async () => {
      const verifiedTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED",
        customDomainVerifiedAt: new Date("2026-01-15")
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(verifiedTenant as never);

      const result = await service.verifyDomain(TENANT_FIXTURE.id);

      expect(result.status).toBe("VERIFIED");
      expect(result.domain).toBe("ingressos.acme.com.br");
      expect(result.dnsInstructions).toBeNull();
    });

    it("deve lancar NotFoundException se nao possui dominio", async () => {
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);

      await expect(service.verifyDomain(TENANT_FIXTURE.id)).rejects.toThrow(NotFoundException);
    });

    it("deve retornar status pendente quando Vercel nao configurada", async () => {
      const pendingTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(pendingTenant as never);

      const result = await service.verifyDomain(TENANT_FIXTURE.id);

      expect(result.status).toBe("PENDING_VERIFICATION");
      expect(result.dnsInstructions).toBeTruthy();
    });
  });

  // --- getDomainStatus ---

  describe("getDomainStatus", () => {
    it("deve retornar null quando tenant nao possui dominio", async () => {
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);

      const result = await service.getDomainStatus(TENANT_FIXTURE.id);

      expect(result.domain).toBeNull();
      expect(result.status).toBeNull();
      expect(result.dnsInstructions).toBeNull();
    });

    it("deve retornar status com instrucoes DNS quando pendente", async () => {
      const pendingTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(pendingTenant as never);

      const result = await service.getDomainStatus(TENANT_FIXTURE.id);

      expect(result.domain).toBe("ingressos.acme.com.br");
      expect(result.status).toBe("PENDING_VERIFICATION");
      expect(result.dnsInstructions).toBeTruthy();
      expect(result.dnsInstructions![0].value).toBe("cname.vercel-dns.com");
    });

    it("deve retornar status sem instrucoes DNS quando verificado", async () => {
      const verifiedTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED",
        customDomainVerifiedAt: new Date("2026-01-15")
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(verifiedTenant as never);

      const result = await service.getDomainStatus(TENANT_FIXTURE.id);

      expect(result.domain).toBe("ingressos.acme.com.br");
      expect(result.status).toBe("VERIFIED");
      expect(result.dnsInstructions).toBeNull();
    });
  });

  // --- getDnsInstructions ---

  describe("getDnsInstructions", () => {
    it("deve retornar instrucao CNAME para dominio", () => {
      const instructions = service.getDnsInstructions("ingressos.acme.com.br");

      expect(instructions).toHaveLength(1);
      expect(instructions[0]).toEqual({
        type: "CNAME",
        name: "ingressos.acme.com.br",
        value: "cname.vercel-dns.com",
        purpose: expect.any(String)
      });
    });
  });
});
