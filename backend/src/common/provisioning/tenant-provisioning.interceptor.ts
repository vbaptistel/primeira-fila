import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { Observable, tap } from "rxjs";
import { FastifyRequest } from "fastify";
import { AuthPrincipal } from "../auth/auth.types";
import { CommercialPoliciesService } from "../../modules/commercial-policies/commercial-policies.service";
import { TenancyBrandingService } from "../../modules/tenancy-branding/tenancy-branding.service";

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
 * Também verifica se o tenant possui registro na tabela `tenants` e
 * emite warning caso não encontre (o Tenant deve ser criado explicitamente
 * via API pelo platform_admin).
 *
 * Utiliza cache em memória (Set) para evitar chamadas redundantes
 * ao banco após o primeiro provisionamento por tenant na vida da aplicação.
 */
@Injectable()
export class TenantProvisioningInterceptor implements NestInterceptor {
  private readonly logger = new Logger(TenantProvisioningInterceptor.name);
  private readonly provisionedTenants = new Set<string>();
  private readonly warnedTenants = new Set<string>();

  constructor(
    private readonly commercialPoliciesService: CommercialPoliciesService,
    private readonly tenancyBrandingService: TenancyBrandingService
  ) {}

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

    if (!this.warnedTenants.has(tenantId)) {
      this.checkTenantExists(tenantId);
    }
  }

  private checkTenantExists(tenantId: string): void {
    this.tenancyBrandingService
      .getTenantOrNull(tenantId)
      .then((tenant) => {
        if (!tenant) {
          this.logger.warn(
            `Tenant ${tenantId} nao possui registro na tabela tenants. Crie-o via POST /v1/tenants.`
          );
        }
        this.warnedTenants.add(tenantId);
      })
      .catch(() => {
        // Silencia erros de verificacao para nao impactar o fluxo principal
      });
  }
}
