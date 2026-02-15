import { BadRequestException, NotFoundException } from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CustomDomainService } from "./custom-domain.service";
import { TenancyBrandingService } from "./tenancy-branding.service";

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

const VERCEL_DOMAIN_CONFIG_RESPONSE = {
  configuredBy: null,
  misconfigured: true,
  recommendedCNAME: [{ rank: 1, value: "cname.vercel-dns.com" }],
  recommendedIPv4: []
};

function setupVercelWithMockedFetch() {
  process.env.VERCEL_TOKEN = "test-token";
  process.env.VERCEL_WEB_CUSTOMER_PROJECT_ID = "prj_test";

  vi.spyOn(globalThis, "fetch").mockImplementation((input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    if (url.includes("/v6/domains/") && url.includes("/config")) {
      return Promise.resolve(
        new Response(JSON.stringify(VERCEL_DOMAIN_CONFIG_RESPONSE), {
          status: 200,
          headers: { "Content-Type": "application/json" }
        })
      ) as Promise<Response>;
    }
    if (url.includes("/v10/projects/") && url.includes("/domains")) {
      return Promise.resolve(new Response(JSON.stringify({}), { status: 200 })) as Promise<Response>;
    }
    return Promise.resolve(new Response("{}", { status: 200 })) as Promise<Response>;
  });
}

describe("CustomDomainService", () => {
  let service: CustomDomainService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let tenancyBranding: ReturnType<typeof createMockTenancyBrandingService>;

  beforeEach(() => {
    // Garantir que variaveis Vercel nao estao setadas nos testes
    delete process.env.VERCEL_TOKEN;
    delete process.env.VERCEL_TEAM_ID;
    delete process.env.VERCEL_WEB_CUSTOMER_PROJECT_ID;

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
      setupVercelWithMockedFetch();
      const svc = new CustomDomainService(
        prisma as unknown as PrismaService,
        tenancyBranding as unknown as TenancyBrandingService
      );
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      const result = await svc.addDomain(TENANT_FIXTURE.id, "ingressos.acme.com.br");

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

    it("deve lancar BadRequestException quando Vercel nao configurada", async () => {
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      await expect(service.addDomain(TENANT_FIXTURE.id, "ingressos.acme.com.br")).rejects.toThrow(
        BadRequestException
      );
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
      setupVercelWithMockedFetch();
      const svc = new CustomDomainService(
        prisma as unknown as PrismaService,
        tenancyBranding as unknown as TenancyBrandingService
      );
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(tenantWithDomain as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue({} as never);

      const result = await svc.addDomain(TENANT_FIXTURE.id, "ingressos.acme.com.br");
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

    it("deve lancar BadRequestException quando Vercel nao configurada e dominio pendente", async () => {
      const pendingTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(pendingTenant as never);

      await expect(service.verifyDomain(TENANT_FIXTURE.id)).rejects.toThrow(BadRequestException);
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

    it("deve lancar BadRequestException quando Vercel nao configurada e status pendente", async () => {
      const pendingTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(pendingTenant as never);

      await expect(service.getDomainStatus(TENANT_FIXTURE.id)).rejects.toThrow(BadRequestException);
    });

    it("deve retornar status com instrucoes DNS quando pendente", async () => {
      setupVercelWithMockedFetch();
      const svc = new CustomDomainService(
        prisma as unknown as PrismaService,
        tenancyBranding as unknown as TenancyBrandingService
      );
      const pendingTenant = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(tenancyBranding.getTenant).mockResolvedValue(pendingTenant as never);

      const result = await svc.getDomainStatus(TENANT_FIXTURE.id);

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
    it("deve lancar BadRequestException quando Vercel nao configurada", async () => {
      await expect(
        service.getDnsInstructions("ingressos.acme.com.br")
      ).rejects.toThrow(BadRequestException);
    });

    it("deve retornar instrucao CNAME da Vercel quando configurada", async () => {
      setupVercelWithMockedFetch();
      const svc = new CustomDomainService(
        prisma as unknown as PrismaService,
        tenancyBranding as unknown as TenancyBrandingService
      );

      const instructions = await svc.getDnsInstructions("ingressos.acme.com.br");

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
