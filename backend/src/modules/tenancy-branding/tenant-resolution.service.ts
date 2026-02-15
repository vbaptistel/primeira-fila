import { Injectable } from "@nestjs/common";
import { TenantAwareRequest } from "../../common/tenancy/tenant-resolver.middleware";
import { TenancyBrandingService } from "./tenancy-branding.service";

/**
 * Servico centralizado para resolver o tenant id a partir do request.
 * Deve ser usado por qualquer endpoint publico que precise segregar por tenant.
 *
 * Ordem de resolucao:
 * 1. request.resolvedTenant?.id (populado pelo TenantResolverMiddleware quando o Host resolve)
 * 2. Header X-Tenant-Id validado via getTenantOrNull (fallback quando o pipeline Nest/Fastify
 *    nao preserva o mesmo request entre middleware e controller)
 */
@Injectable()
export class TenantResolutionService {
  constructor(private readonly tenancyBranding: TenancyBrandingService) {}

  async resolveTenantId(request: TenantAwareRequest): Promise<string | undefined> {
    if (request.resolvedTenant?.id) return request.resolvedTenant.id;
    const raw = request.headers["x-tenant-id"];
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (typeof id !== "string" || !id.trim()) return undefined;
    const tenant = await this.tenancyBranding.getTenantOrNull(id.trim());
    return tenant?.id;
  }
}
