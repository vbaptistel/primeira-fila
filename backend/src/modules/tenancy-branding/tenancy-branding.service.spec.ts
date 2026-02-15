import { describe, it, expect, beforeEach, vi } from "vitest";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { SubdomainProvisioningService } from "./subdomain-provisioning.service";

function createMockPrisma() {
  return {
    tenant: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  } as unknown as PrismaService;
}

function createMockSubdomainProvisioning() {
  return {
    provisionSubdomain: vi.fn().mockResolvedValue(undefined)
  } as unknown as SubdomainProvisioningService;
}

const TENANT_FIXTURE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Acme Eventos",
  slug: "acme-eventos",
  subdomain: "acme",
  logoUrl: "https://example.com/logo.png",
  faviconUrl: "https://example.com/favicon.ico",
  primaryColor: "#6366f1",
  secondaryColor: "#FFFFFF",
  accentColor: "#3B82F6",
  colorScheme: "light",
  footerText: "Acme Eventos - Sua experiencia.",
  termsUrl: "https://acme.com/termos",
  privacyUrl: "https://acme.com/privacidade",
  socialLinks: { instagram: "@acme" },
  isActive: true,
  customDomain: null,
  customDomainStatus: null,
  customDomainVerifiedAt: null,
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-01-01")
};

describe("TenancyBrandingService", () => {
  let service: TenancyBrandingService;
  let prisma: ReturnType<typeof createMockPrisma>;
  let subdomainProvisioning: ReturnType<typeof createMockSubdomainProvisioning>;

  beforeEach(() => {
    prisma = createMockPrisma();
    subdomainProvisioning = createMockSubdomainProvisioning();
    service = new TenancyBrandingService(
      prisma as unknown as PrismaService,
      subdomainProvisioning as unknown as SubdomainProvisioningService
    );
  });

  // --- createTenant ---

  describe("createTenant", () => {
    it("deve criar tenant com dados validos", async () => {
      vi.mocked(prisma.tenant.create).mockResolvedValue(TENANT_FIXTURE as never);

      const result = await service.createTenant({
        name: TENANT_FIXTURE.name,
        slug: TENANT_FIXTURE.slug,
        subdomain: TENANT_FIXTURE.subdomain
      });

      expect(result).toEqual(TENANT_FIXTURE);
      expect(prisma.tenant.create).toHaveBeenCalledOnce();
      const createData = vi.mocked(prisma.tenant.create).mock.calls[0][0].data as Record<string, unknown>;
      expect(createData).not.toHaveProperty("id");
      expect(subdomainProvisioning.provisionSubdomain).toHaveBeenCalledWith(TENANT_FIXTURE);
    });

    it("deve retornar tenant criado mesmo quando provisionSubdomain falha", async () => {
      vi.mocked(prisma.tenant.create).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(subdomainProvisioning.provisionSubdomain).mockRejectedValue(
        new Error("Vercel API error")
      );

      const result = await service.createTenant({
        name: TENANT_FIXTURE.name,
        slug: TENANT_FIXTURE.slug,
        subdomain: TENANT_FIXTURE.subdomain
      });

      expect(result).toEqual(TENANT_FIXTURE);
      expect(prisma.tenant.create).toHaveBeenCalledOnce();
    });

    it("deve lancar ConflictException quando slug/subdomain ja existe", async () => {
      vi.mocked(prisma.tenant.create).mockRejectedValue({ code: "P2002" });

      await expect(
        service.createTenant({
          name: TENANT_FIXTURE.name,
          slug: TENANT_FIXTURE.slug,
          subdomain: TENANT_FIXTURE.subdomain
        })
      ).rejects.toThrow(ConflictException);
    });

    it("deve propagar erro nao-Prisma", async () => {
      vi.mocked(prisma.tenant.create).mockRejectedValue(new Error("Connection lost"));

      await expect(
        service.createTenant({
          name: TENANT_FIXTURE.name,
          slug: TENANT_FIXTURE.slug,
          subdomain: TENANT_FIXTURE.subdomain
        })
      ).rejects.toThrow("Connection lost");
    });
  });

  // --- getTenant ---

  describe("getTenant", () => {
    it("deve retornar tenant quando encontrado", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);

      const result = await service.getTenant(TENANT_FIXTURE.id);
      expect(result).toEqual(TENANT_FIXTURE);
    });

    it("deve lancar NotFoundException quando tenant nao existe", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      await expect(service.getTenant("nonexistent-id")).rejects.toThrow(NotFoundException);
    });
  });

  // --- getTenantOrNull ---

  describe("getTenantOrNull", () => {
    it("deve retornar tenant quando encontrado", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);

      const result = await service.getTenantOrNull(TENANT_FIXTURE.id);
      expect(result).toEqual(TENANT_FIXTURE);
    });

    it("deve retornar null quando tenant nao existe", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await service.getTenantOrNull("nonexistent-id");
      expect(result).toBeNull();
    });
  });

  // --- updateTenant ---

  describe("updateTenant", () => {
    it("deve atualizar campos de branding", async () => {
      const updated = { ...TENANT_FIXTURE, name: "Acme Novo" };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(prisma.tenant.update).mockResolvedValue(updated as never);

      const result = await service.updateTenant(TENANT_FIXTURE.id, { name: "Acme Novo" });

      expect(result.name).toBe("Acme Novo");
      expect(prisma.tenant.update).toHaveBeenCalledOnce();
    });

    it("deve lancar NotFoundException se tenant nao existe", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      await expect(
        service.updateTenant("nonexistent-id", { name: "Teste" })
      ).rejects.toThrow(NotFoundException);
    });

    it("deve lancar ConflictException se slug/subdomain ja em uso", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);
      vi.mocked(prisma.tenant.update).mockRejectedValue({ code: "P2002" });

      await expect(
        service.updateTenant(TENANT_FIXTURE.id, { slug: "slug-existente" })
      ).rejects.toThrow(ConflictException);
    });
  });

  // --- resolveBySubdomain ---

  describe("resolveBySubdomain", () => {
    it("deve resolver tenant ativo por subdomain", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);

      const result = await service.resolveBySubdomain("acme");
      expect(result).toEqual(TENANT_FIXTURE);
    });

    it("deve retornar null para subdomain inexistente", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await service.resolveBySubdomain("nao-existe");
      expect(result).toBeNull();
    });

    it("deve retornar null para tenant inativo", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue({
        ...TENANT_FIXTURE,
        isActive: false
      } as never);

      const result = await service.resolveBySubdomain("acme");
      expect(result).toBeNull();
    });

    it("deve usar cache na segunda chamada", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);

      await service.resolveBySubdomain("acme");
      await service.resolveBySubdomain("acme");

      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // --- resolveByDomain ---

  describe("resolveByDomain", () => {
    it("deve resolver tenant com dominio customizado verificado", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED"
      };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(tenantWithDomain as never);

      const result = await service.resolveByDomain("ingressos.acme.com.br");
      expect(result).toEqual(tenantWithDomain);
    });

    it("deve retornar null para dominio nao verificado", async () => {
      const tenantPending = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "PENDING_VERIFICATION"
      };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(tenantPending as never);

      const result = await service.resolveByDomain("ingressos.acme.com.br");
      expect(result).toBeNull();
    });

    it("deve retornar null para dominio inexistente", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(null);

      const result = await service.resolveByDomain("nao-existe.com");
      expect(result).toBeNull();
    });

    it("deve usar cache na segunda chamada", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED"
      };
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(tenantWithDomain as never);

      await service.resolveByDomain("ingressos.acme.com.br");
      await service.resolveByDomain("ingressos.acme.com.br");

      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);
    });
  });

  // --- getPublicBranding ---

  describe("getPublicBranding", () => {
    it("deve retornar apenas campos publicos", () => {
      const branding = service.getPublicBranding(TENANT_FIXTURE as never);

      expect(branding).toEqual({
        id: TENANT_FIXTURE.id,
        name: TENANT_FIXTURE.name,
        slug: TENANT_FIXTURE.slug,
        subdomain: TENANT_FIXTURE.subdomain,
        logoUrl: TENANT_FIXTURE.logoUrl,
        faviconUrl: TENANT_FIXTURE.faviconUrl,
        primaryColor: TENANT_FIXTURE.primaryColor,
        secondaryColor: TENANT_FIXTURE.secondaryColor,
        accentColor: TENANT_FIXTURE.accentColor,
        colorScheme: TENANT_FIXTURE.colorScheme,
        footerText: TENANT_FIXTURE.footerText,
        termsUrl: TENANT_FIXTURE.termsUrl,
        privacyUrl: TENANT_FIXTURE.privacyUrl,
        socialLinks: TENANT_FIXTURE.socialLinks,
        customDomain: TENANT_FIXTURE.customDomain
      });

      // Nao deve conter campos internos
      expect(branding).not.toHaveProperty("isActive");
      expect(branding).not.toHaveProperty("customDomainStatus");
      expect(branding).not.toHaveProperty("createdAt");
      expect(branding).not.toHaveProperty("updatedAt");
    });
  });

  // --- invalidateCache ---

  describe("invalidateCache", () => {
    it("deve invalidar cache apos update", async () => {
      vi.mocked(prisma.tenant.findUnique).mockResolvedValue(TENANT_FIXTURE as never);

      // Popula cache
      await service.resolveBySubdomain("acme");
      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(1);

      // Invalida
      service.invalidateCache(TENANT_FIXTURE as never);

      // Proxima chamada vai ao banco
      await service.resolveBySubdomain("acme");
      expect(prisma.tenant.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
