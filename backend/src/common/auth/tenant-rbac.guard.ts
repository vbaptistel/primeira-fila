import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { FastifyRequest } from "fastify";
import { AppRole, AuthPrincipal } from "./auth.types";
import { TENANT_ROLES_KEY } from "./roles.decorator";
import { SupabaseJwtVerifierService } from "./supabase-jwt-verifier.service";

type AuthenticatedRequest = FastifyRequest & {
  authPrincipal?: AuthPrincipal;
  params: {
    tenantId?: string;
  };
};

@Injectable()
export class TenantRbacGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtVerifier: SupabaseJwtVerifierService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const requiredRoles = this.reflector.getAllAndOverride<AppRole[]>(TENANT_ROLES_KEY, [
      context.getHandler(),
      context.getClass()
    ]) ?? [];

    const token = this.readBearerToken(request.headers.authorization);
    const principal = await this.jwtVerifier.verifyToken(token);
    request.authPrincipal = principal;

    if (requiredRoles.length > 0 && !this.hasAnyRole(principal.roles, requiredRoles)) {
      throw new ForbiddenException("Perfil sem permissao para este recurso.");
    }

    const tenantIdParam = request.params?.tenantId;
    if (tenantIdParam) {
      this.assertTenantScope(principal, tenantIdParam);
    }

    return true;
  }

  private readBearerToken(authorizationHeader: string | string[] | undefined): string {
    const value = Array.isArray(authorizationHeader)
      ? authorizationHeader[0]
      : authorizationHeader;

    if (!value) {
      throw new UnauthorizedException("Authorization Bearer token obrigatorio.");
    }

    const match = value.match(/^Bearer\s+(.+)$/i);
    if (!match) {
      throw new UnauthorizedException("Authorization deve usar esquema Bearer.");
    }

    const token = match[1].trim();
    if (!token) {
      throw new UnauthorizedException("Token vazio.");
    }

    return token;
  }

  private hasAnyRole(roles: AppRole[], requiredRoles: AppRole[]): boolean {
    const roleSet = new Set(roles);
    return requiredRoles.some((role) => roleSet.has(role));
  }

  private assertTenantScope(principal: AuthPrincipal, tenantIdParam: string): void {
    if (principal.roles.includes("platform_admin")) {
      return;
    }

    if (!principal.tenantId) {
      throw new ForbiddenException("Token sem tenant associado para operacao de escopo.");
    }

    if (principal.tenantId !== tenantIdParam) {
      throw new ForbiddenException("Violacao de escopo: tenant do token nao corresponde a rota.");
    }
  }
}
