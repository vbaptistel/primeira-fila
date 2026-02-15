import { describe, it, expect, beforeEach, vi } from "vitest";
import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of } from "rxjs";
import { TenantProvisioningInterceptor } from "./tenant-provisioning.interceptor";
import { CommercialPoliciesService } from "../../modules/commercial-policies/commercial-policies.service";

function createMockExecutionContext(authPrincipal?: { tenantId?: string }): ExecutionContext {
  const request: Record<string, unknown> = {
    authPrincipal: authPrincipal ?? undefined
  };

  return {
    switchToHttp: () => ({
      getRequest: () => request
    })
  } as unknown as ExecutionContext;
}

function createMockCallHandler(): CallHandler {
  return {
    handle: () => of({ ok: true })
  };
}

describe("TenantProvisioningInterceptor", () => {
  let interceptor: TenantProvisioningInterceptor;
  let commercialPoliciesService: CommercialPoliciesService;

  beforeEach(() => {
    commercialPoliciesService = {
      ensureDefaultPolicy: vi.fn().mockResolvedValue({
        id: "policy-001",
        version: "platform_default_v1"
      })
    } as unknown as CommercialPoliciesService;

    interceptor = new TenantProvisioningInterceptor(commercialPoliciesService);
  });

  it("nao deve provisionar quando nao ha authPrincipal na request", () => {
    const context = createMockExecutionContext(undefined);
    const next = createMockCallHandler();

    return new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(commercialPoliciesService.ensureDefaultPolicy).not.toHaveBeenCalled();
          resolve();
        }
      });
    });
  });

  it("nao deve provisionar quando authPrincipal nao possui tenantId", () => {
    const context = createMockExecutionContext({ tenantId: undefined });
    const next = createMockCallHandler();

    return new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        next: () => {
          expect(commercialPoliciesService.ensureDefaultPolicy).not.toHaveBeenCalled();
          resolve();
        }
      });
    });
  });

  it("deve provisionar politica default na primeira requisicao de um tenant", async () => {
    const context = createMockExecutionContext({ tenantId: "tenant-aaa" });
    const next = createMockCallHandler();

    await new Promise<void>((resolve) => {
      interceptor.intercept(context, next).subscribe({
        next: () => {
          // Aguarda o provisionamento assíncrono
          setTimeout(() => {
            expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledWith("tenant-aaa");
            resolve();
          }, 10);
        }
      });
    });
  });

  it("nao deve provisionar novamente para o mesmo tenant", async () => {
    const next = createMockCallHandler();

    // Primeira requisição
    const context1 = createMockExecutionContext({ tenantId: "tenant-aaa" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context1, next).subscribe({ next: () => resolve() });
    });

    // Aguarda provisionamento assíncrono
    await new Promise((r) => setTimeout(r, 20));

    vi.mocked(commercialPoliciesService.ensureDefaultPolicy).mockClear();

    // Segunda requisição do mesmo tenant
    const context2 = createMockExecutionContext({ tenantId: "tenant-aaa" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context2, next).subscribe({ next: () => resolve() });
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(commercialPoliciesService.ensureDefaultPolicy).not.toHaveBeenCalled();
  });

  it("deve provisionar separadamente para tenants diferentes", async () => {
    const next = createMockCallHandler();

    const context1 = createMockExecutionContext({ tenantId: "tenant-aaa" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context1, next).subscribe({ next: () => resolve() });
    });

    const context2 = createMockExecutionContext({ tenantId: "tenant-bbb" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context2, next).subscribe({ next: () => resolve() });
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledWith("tenant-aaa");
    expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledWith("tenant-bbb");
    expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledTimes(2);
  });

  it("deve remover tenant do cache se provisionamento falhar para permitir retry", async () => {
    vi.mocked(commercialPoliciesService.ensureDefaultPolicy).mockRejectedValueOnce(
      new Error("Falha de conexao")
    );

    const next = createMockCallHandler();

    // Primeira tentativa (vai falhar)
    const context1 = createMockExecutionContext({ tenantId: "tenant-fail" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context1, next).subscribe({ next: () => resolve() });
    });

    await new Promise((r) => setTimeout(r, 20));

    // Restaura mock para sucesso
    vi.mocked(commercialPoliciesService.ensureDefaultPolicy).mockResolvedValue({
      id: "policy-retry",
      version: "platform_default_v1"
    } as never);
    vi.mocked(commercialPoliciesService.ensureDefaultPolicy).mockClear();

    // Segunda tentativa (deve tentar novamente)
    const context2 = createMockExecutionContext({ tenantId: "tenant-fail" });
    await new Promise<void>((resolve) => {
      interceptor.intercept(context2, next).subscribe({ next: () => resolve() });
    });

    await new Promise((r) => setTimeout(r, 20));

    expect(commercialPoliciesService.ensureDefaultPolicy).toHaveBeenCalledWith("tenant-fail");
  });
});
