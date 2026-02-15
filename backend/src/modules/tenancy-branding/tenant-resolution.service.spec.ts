import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantAwareRequest } from "../../common/tenancy/tenant-resolver.middleware";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { TenantResolutionService } from "./tenant-resolution.service";

const TENANT_ID = "a1a1a1a1-0000-4000-a000-000000000001";

function createMockRequest(overrides: Partial<TenantAwareRequest> = {}): TenantAwareRequest {
  return {
    headers: {},
    resolvedTenant: undefined,
    ...overrides
  } as unknown as TenantAwareRequest;
}

describe("TenantResolutionService", () => {
  let service: TenantResolutionService;
  let tenancyBranding: { getTenantOrNull: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    tenancyBranding = { getTenantOrNull: vi.fn() };
    service = new TenantResolutionService(
      tenancyBranding as unknown as TenancyBrandingService
    );
  });

  it("deve retornar id quando request.resolvedTenant esta definido", async () => {
    const request = createMockRequest({
      resolvedTenant: { id: TENANT_ID } as never
    });

    const result = await service.resolveTenantId(request);

    expect(result).toBe(TENANT_ID);
    expect(tenancyBranding.getTenantOrNull).not.toHaveBeenCalled();
  });

  it("deve usar X-Tenant-Id quando resolvedTenant nao esta definido e tenant existe", async () => {
    const request = createMockRequest({
      headers: { "x-tenant-id": TENANT_ID }
    });
    vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue({ id: TENANT_ID } as never);

    const result = await service.resolveTenantId(request);

    expect(result).toBe(TENANT_ID);
    expect(tenancyBranding.getTenantOrNull).toHaveBeenCalledWith(TENANT_ID);
  });

  it("deve retornar undefined quando X-Tenant-Id nao existe no banco", async () => {
    const request = createMockRequest({
      headers: { "x-tenant-id": "00000000-0000-0000-0000-000000000099" }
    });
    vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue(null);

    const result = await service.resolveTenantId(request);

    expect(result).toBeUndefined();
  });

  it("deve retornar undefined quando nao ha resolvedTenant nem header valido", async () => {
    const request = createMockRequest();

    const result = await service.resolveTenantId(request);

    expect(result).toBeUndefined();
    expect(tenancyBranding.getTenantOrNull).not.toHaveBeenCalled();
  });

  it("deve tratar X-Tenant-Id como array (primeiro valor)", async () => {
    const request = createMockRequest({
      headers: { "x-tenant-id": [TENANT_ID] }
    });
    vi.mocked(tenancyBranding.getTenantOrNull).mockResolvedValue({ id: TENANT_ID } as never);

    const result = await service.resolveTenantId(request);

    expect(result).toBe(TENANT_ID);
    expect(tenancyBranding.getTenantOrNull).toHaveBeenCalledWith(TENANT_ID);
  });
});
