import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { FastifyRequest } from "fastify";
import { AuthPrincipal } from "../auth/auth.types";
import { CommercialPoliciesService } from "../../modules/commercial-policies/commercial-policies.service";

type AuthenticatedRequest = FastifyRequest & {
  authPrincipal?: AuthPrincipal;
};

/**
 * Interceptor que garante o provisionamento automático de recursos
 * essenciais para cada tenant na primeira requisição autenticada.
 *
 * Atualmente provisiona:
 * - Política comercial default (`platform_default_v1`).
 *
 * Utiliza cache em memória (Set) para evitar chamadas redundantes
 * ao banco após o primeiro provisionamento por tenant na vida da aplicação.
 */
@Injectable()
export class TenantProvisioningInterceptor implements NestInterceptor {
  private readonly provisionedTenants = new Set<string>();

  constructor(private readonly commercialPoliciesService: CommercialPoliciesService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const tenantId = request.authPrincipal?.tenantId;

    if (!tenantId || this.provisionedTenants.has(tenantId)) {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.provisionTenantAsync(tenantId);
        }
      })
    );
  }

  private provisionTenantAsync(tenantId: string): void {
    this.provisionedTenants.add(tenantId);

    this.commercialPoliciesService.ensureDefaultPolicy(tenantId).catch(() => {
      this.provisionedTenants.delete(tenantId);
    });
  }
}
