import { describe, it, expect, beforeEach, vi } from "vitest";
import { TenantResolverMiddleware, TenantAwareRequest } from "./tenant-resolver.middleware";
import { TenancyBrandingService } from "../../modules/tenancy-branding/tenancy-branding.service";
import { FastifyReply } from "fastify";

function createMockTenancyBrandingService() {
  return {
    resolveBySubdomain: vi.fn(),
    resolveByDomain: vi.fn()
  } as unknown as TenancyBrandingService;
}

function createMockRequest(host?: string, xForwardedHost?: string): TenantAwareRequest {
  const headers: Record<string, string | string[] | undefined> = {};
  if (host) headers.host = host;
  if (xForwardedHost) headers["x-forwarded-host"] = xForwardedHost;

  return {
    headers,
    resolvedTenant: undefined
  } as unknown as TenantAwareRequest;
}

const TENANT_FIXTURE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Acme Eventos",
  slug: "acme-eventos",
  subdomain: "acme",
  isActive: true
};

describe("TenantResolverMiddleware", () => {
  let middleware: TenantResolverMiddleware;
  let tenancyBranding: ReturnType<typeof createMockTenancyBrandingService>;

  beforeEach(() => {
    process.env.PLATFORM_BASE_DOMAIN = "primeira-fila.com";
    tenancyBranding = createMockTenancyBrandingService();
    middleware = new TenantResolverMiddleware(
      tenancyBranding as unknown as TenancyBrandingService
    );
  });

  // --- Resolucao por subdominio ---

  describe("resolucao por subdominio", () => {
    it("deve resolver tenant por subdominio do Host header", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("acme.primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
      expect(next).toHaveBeenCalledOnce();
    });

    it("deve preferir X-Forwarded-Host sobre Host", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("localhost:3000", "acme.primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });

    it("deve remover porta do host", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("acme.primeira-fila.com:443");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
    });
  });

  // --- Dominio base (sem resolucao) ---

  describe("dominio base", () => {
    it("nao deve resolver para dominio base puro", async () => {
      const request = createMockRequest("primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(request.resolvedTenant).toBeUndefined();
      expect(tenancyBranding.resolveBySubdomain).not.toHaveBeenCalled();
      expect(tenancyBranding.resolveByDomain).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledOnce();
    });

    it("nao deve resolver para www do dominio base", async () => {
      const request = createMockRequest("www.primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(request.resolvedTenant).toBeUndefined();
    });
  });

  // --- Dominio customizado ---

  describe("resolucao por dominio customizado", () => {
    it("deve resolver tenant por dominio customizado", async () => {
      const tenantWithDomain = {
        ...TENANT_FIXTURE,
        customDomain: "ingressos.acme.com.br",
        customDomainStatus: "VERIFIED"
      };
      vi.mocked(tenancyBranding.resolveByDomain).mockResolvedValue(tenantWithDomain as never);

      const request = createMockRequest("ingressos.acme.com.br");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(tenancyBranding.resolveByDomain).toHaveBeenCalledWith("ingressos.acme.com.br");
      expect(request.resolvedTenant).toEqual(tenantWithDomain);
    });

    it("nao deve resolver para dominio customizado nao encontrado", async () => {
      vi.mocked(tenancyBranding.resolveByDomain).mockResolvedValue(null);

      const request = createMockRequest("dominio-desconhecido.com.br");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(request.resolvedTenant).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --- Subdominios com niveis extras ---

  describe("subdominios multi-nivel", () => {
    it("nao deve resolver subdominio com niveis extras", async () => {
      const request = createMockRequest("a.b.primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(tenancyBranding.resolveBySubdomain).not.toHaveBeenCalled();
      // Deve tentar como dominio customizado
      expect(tenancyBranding.resolveByDomain).not.toHaveBeenCalled();
    });
  });

  // --- Sem host ---

  describe("request sem host", () => {
    it("deve chamar next sem resolver quando nao ha host", async () => {
      const request = createMockRequest();
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(request.resolvedTenant).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    });
  });

  // --- Tratamento de erros ---

  describe("tratamento de erros", () => {
    it("deve chamar next mesmo se resolver lanca erro", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockRejectedValue(
        new Error("DB connection lost")
      );

      const request = createMockRequest("acme.primeira-fila.com");
      const next = vi.fn();

      await middleware.use(request, {} as FastifyReply, next);

      expect(request.resolvedTenant).toBeUndefined();
      expect(next).toHaveBeenCalledOnce();
    });
  });
});
