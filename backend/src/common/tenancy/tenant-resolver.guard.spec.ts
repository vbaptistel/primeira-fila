import { ExecutionContext } from "@nestjs/common";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenancyBrandingService } from "../../modules/tenancy-branding/tenancy-branding.service";
import { TenantAwareRequest, TenantResolverGuard } from "./tenant-resolver.guard";

function createMockTenancyBrandingService() {
  return {
    resolveBySubdomain: vi.fn(),
    resolveByDomain: vi.fn(),
    getTenantOrNull: vi.fn()
  } as unknown as TenancyBrandingService;
}

function createMockRequest(
  host?: string,
  opts?: { xForwardedHost?: string; xTenantId?: string }
): TenantAwareRequest {
  const headers: Record<string, string | string[] | undefined> = {};
  if (host) headers.host = host;
  if (opts?.xForwardedHost) headers["x-forwarded-host"] = opts.xForwardedHost;
  if (opts?.xTenantId) headers["x-tenant-id"] = opts.xTenantId;

  return {
    headers,
    resolvedTenant: undefined
  } as unknown as TenantAwareRequest;
}

function createMockExecutionContext(request: TenantAwareRequest): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

const TENANT_FIXTURE = {
  id: "00000000-0000-0000-0000-000000000001",
  name: "Acme Eventos",
  slug: "acme-eventos",
  subdomain: "acme",
  isActive: true
};

describe("TenantResolverGuard", () => {
  let guard: TenantResolverGuard;
  let tenancyBranding: ReturnType<typeof createMockTenancyBrandingService>;

  beforeEach(() => {
    delete process.env.PLATFORM_BASE_DOMAINS;
    tenancyBranding = createMockTenancyBrandingService();
    guard = new TenantResolverGuard(
      tenancyBranding as unknown as TenancyBrandingService
    );
  });

  // --- Sempre retorna true ---

  it("deve sempre retornar true (nunca bloqueia)", async () => {
    const request = createMockRequest("primeirafila.app");
    const context = createMockExecutionContext(request);

    const result = await guard.canActivate(context);

    expect(result).toBe(true);
  });

  // --- Resolucao por subdominio ---

  describe("resolucao por subdominio", () => {
    it("deve resolver tenant por subdominio do Host header", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("acme.primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });

    it("deve preferir X-Forwarded-Host sobre Host", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("localhost:3000", {
        xForwardedHost: "acme.primeirafila.app"
      });
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });

    it("deve remover porta do host", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("acme.primeirafila.app:443");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
    });

    it("deve resolver tenant por subdominio em primeirafila.app", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("acme.primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveBySubdomain).toHaveBeenCalledWith("acme");
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });
  });

  // --- Dominio base (sem resolucao) ---

  describe("dominio base", () => {
    it("nao deve resolver para dominio base puro", async () => {
      const request = createMockRequest("primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
      expect(tenancyBranding.resolveBySubdomain).not.toHaveBeenCalled();
      expect(tenancyBranding.resolveByDomain).not.toHaveBeenCalled();
    });

    it("nao deve resolver para www do dominio base", async () => {
      const request = createMockRequest("www.primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
    });

    it("nao deve resolver para dominio base primeirafila.app puro", async () => {
      const request = createMockRequest("primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
      expect(tenancyBranding.resolveBySubdomain).not.toHaveBeenCalled();
      expect(tenancyBranding.resolveByDomain).not.toHaveBeenCalled();
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
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveByDomain).toHaveBeenCalledWith("ingressos.acme.com.br");
      expect(request.resolvedTenant).toEqual(tenantWithDomain);
    });

    it("nao deve resolver para dominio customizado nao encontrado", async () => {
      vi.mocked(tenancyBranding.resolveByDomain).mockResolvedValue(null);

      const request = createMockRequest("dominio-desconhecido.com.br");
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
      expect(result).toBe(true);
    });
  });

  // --- Subdominios com niveis extras ---

  describe("subdominios multi-nivel", () => {
    it("nao deve resolver subdominio com niveis extras", async () => {
      const request = createMockRequest("a.b.primeirafila.app");
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.resolveBySubdomain).not.toHaveBeenCalled();
      expect(tenancyBranding.resolveByDomain).not.toHaveBeenCalled();
    });
  });

  // --- Sem host ---

  describe("request sem host", () => {
    it("deve retornar true sem resolver quando nao ha host", async () => {
      const request = createMockRequest();
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
      expect(result).toBe(true);
    });
  });

  // --- Fallback X-Tenant-Id (quando Host nao resolve, ex.: localhost) ---

  describe("fallback X-Tenant-Id", () => {
    it("deve resolver tenant pelo header X-Tenant-Id quando Host nao resolve", async () => {
      vi.mocked(tenancyBranding.resolveByDomain).mockResolvedValue(null);
      vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest("localhost", {
        xTenantId: "00000000-0000-0000-0000-000000000001"
      });
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.getTenantOrNull).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001"
      );
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });

    it("nao deve definir tenant quando X-Tenant-Id nao existe no banco", async () => {
      vi.mocked(tenancyBranding.resolveByDomain).mockResolvedValue(null);
      vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue(null);

      const request = createMockRequest("localhost", {
        xTenantId: "00000000-0000-0000-0000-000000000099"
      });
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
    });

    it("deve resolver pelo X-Tenant-Id mesmo quando nao ha host", async () => {
      vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue(TENANT_FIXTURE as never);

      const request = createMockRequest(undefined, {
        xTenantId: "00000000-0000-0000-0000-000000000001"
      });
      const context = createMockExecutionContext(request);

      await guard.canActivate(context);

      expect(tenancyBranding.getTenantOrNull).toHaveBeenCalledWith(
        "00000000-0000-0000-0000-000000000001"
      );
      expect(request.resolvedTenant).toEqual(TENANT_FIXTURE);
    });
  });

  // --- Tratamento de erros ---

  describe("tratamento de erros", () => {
    it("deve retornar true mesmo se resolver lanca erro", async () => {
      vi.mocked(tenancyBranding.resolveBySubdomain).mockRejectedValue(
        new Error("DB connection lost")
      );

      const request = createMockRequest("acme.primeirafila.app");
      const context = createMockExecutionContext(request);

      const result = await guard.canActivate(context);

      expect(request.resolvedTenant).toBeUndefined();
      expect(result).toBe(true);
    });
  });
});
