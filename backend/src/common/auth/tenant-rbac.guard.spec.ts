import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExecutionContext, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { TenantRbacGuard } from "./tenant-rbac.guard";
import { SupabaseJwtVerifierService } from "./supabase-jwt-verifier.service";
import { AuthPrincipal } from "./auth.types";

function createMockExecutionContext(overrides?: {
  authorization?: string;
  tenantIdParam?: string;
  reflectorRoles?: string[];
}): { context: ExecutionContext; request: Record<string, unknown> } {
  const request: Record<string, unknown> = {
    headers: {
      authorization: overrides?.authorization ?? "Bearer valid-token"
    },
    params: {
      tenantId: overrides?.tenantIdParam ?? "tenant-aaa"
    }
  };

  const context = {
    switchToHttp: () => ({
      getRequest: () => request
    }),
    getHandler: () => ({}),
    getClass: () => ({})
  } as unknown as ExecutionContext;

  return { context, request };
}

function createMockPrincipal(overrides?: Partial<AuthPrincipal>): AuthPrincipal {
  return {
    userId: "user-001",
    tenantId: "tenant-aaa",
    roles: ["organizer_admin"],
    claims: { sub: "user-001" },
    ...overrides
  };
}

describe("TenantRbacGuard", () => {
  let guard: TenantRbacGuard;
  let reflector: Reflector;
  let jwtVerifier: SupabaseJwtVerifierService;

  beforeEach(() => {
    reflector = new Reflector();
    jwtVerifier = {
      verifyToken: vi.fn()
    } as unknown as SupabaseJwtVerifierService;
    guard = new TenantRbacGuard(reflector, jwtVerifier);
  });

  describe("autenticacao (token)", () => {
    it("deve rejeitar requisicao sem header Authorization", async () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      const { context } = createMockExecutionContext({ authorization: undefined });
      (context.switchToHttp().getRequest() as Record<string, unknown>).headers = {};

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("deve rejeitar requisicao com Authorization sem esquema Bearer", async () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      const { context } = createMockExecutionContext({ authorization: "Basic abc123" });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("deve rejeitar requisicao com token vazio", async () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      const { context } = createMockExecutionContext({ authorization: "Bearer " });

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });

    it("deve rejeitar quando jwtVerifier lanca erro de token invalido", async () => {
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockRejectedValue(
        new UnauthorizedException("Token invalido.")
      );
      const { context } = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    });
  });

  describe("controle de roles", () => {
    it("deve permitir acesso quando principal possui role requerida", async () => {
      const principal = createMockPrincipal({ roles: ["organizer_admin"] });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve negar acesso quando principal nao possui role requerida", async () => {
      const principal = createMockPrincipal({ roles: ["buyer"] });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({});

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow("Perfil sem permissao");
    });

    it("deve permitir acesso quando nenhuma role e requerida", async () => {
      const principal = createMockPrincipal({ roles: ["buyer"] });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(undefined);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve permitir acesso quando principal possui ao menos uma das roles requeridas", async () => {
      const principal = createMockPrincipal({ roles: ["platform_admin"] });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin", "platform_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({});

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("isolamento de tenant (acesso cruzado)", () => {
    it("deve permitir acesso quando tenantId do token corresponde ao parametro da rota", async () => {
      const principal = createMockPrincipal({
        tenantId: "tenant-aaa",
        roles: ["organizer_admin"]
      });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({ tenantIdParam: "tenant-aaa" });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve bloquear acesso cruzado quando tenantId do token difere do parametro da rota", async () => {
      const principal = createMockPrincipal({
        tenantId: "tenant-aaa",
        roles: ["organizer_admin"]
      });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({ tenantIdParam: "tenant-bbb" });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow("Violacao de escopo");
    });

    it("deve bloquear acesso quando token nao possui tenantId e rota exige escopo de tenant", async () => {
      const principal = createMockPrincipal({
        tenantId: undefined,
        roles: ["organizer_admin"]
      });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({ tenantIdParam: "tenant-aaa" });

      await expect(guard.canActivate(context)).rejects.toThrow(ForbiddenException);
      await expect(guard.canActivate(context)).rejects.toThrow("Token sem tenant associado");
    });

    it("deve permitir que platform_admin acesse qualquer tenant (bypass)", async () => {
      const principal = createMockPrincipal({
        tenantId: "tenant-aaa",
        roles: ["platform_admin"]
      });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin", "platform_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({ tenantIdParam: "tenant-outro" });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });

    it("deve permitir que platform_admin sem tenantId acesse rota de tenant", async () => {
      const principal = createMockPrincipal({
        tenantId: undefined,
        roles: ["platform_admin"]
      });
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["platform_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context } = createMockExecutionContext({ tenantIdParam: "tenant-qualquer" });

      const result = await guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe("propagacao de authPrincipal na request", () => {
    it("deve anexar authPrincipal na request apos autenticacao bem sucedida", async () => {
      const principal = createMockPrincipal();
      vi.spyOn(reflector, "getAllAndOverride").mockReturnValue(["organizer_admin"]);
      vi.mocked(jwtVerifier.verifyToken).mockResolvedValue(principal);
      const { context, request } = createMockExecutionContext({});

      await guard.canActivate(context);

      expect(request["authPrincipal"]).toEqual(principal);
    });
  });
});
