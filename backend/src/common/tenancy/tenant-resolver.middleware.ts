import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { Tenant } from "../../generated/prisma/client";
import { TenancyBrandingService } from "../../modules/tenancy-branding/tenancy-branding.service";
import { parseHostForTenant } from "./tenant-resolver.utils";

export type TenantAwareRequest = FastifyRequest & {
  resolvedTenant?: Tenant;
};

/**
 * Middleware que resolve o tenant a partir do header Host.
 *
 * Logica de resolucao (via tenant-resolver.utils):
 * 1. Se o host e um subdominio de um dominio base (e.g. acme.primeirafila.app, acme.primeirafila.app),
 *    extrai o subdomain e busca por subdomain.
 * 2. Se o host nao pertence a nenhum dominio base, trata como dominio customizado
 *    e busca por customDomain (somente VERIFIED).
 * 3. Se o host e dominio base puro, www ou subdominio multi-nivel, nao resolve
 *    (rotas admin usam tenantId do JWT).
 *
 * O middleware apenas popula request.resolvedTenant e nunca bloqueia.
 * Cabe aos controllers/guards decidir se o tenant e obrigatorio.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);

  constructor(private readonly tenancyBrandingService: TenancyBrandingService) { }

  async use(
    request: TenantAwareRequest,
    _reply: FastifyReply,
    next: () => void
  ): Promise<void> {
    const host = this.extractHost(request);
    let tenant: Tenant | null = null;

    if (host) {
      try {
        tenant = await this.resolve(host);
      } catch (error) {
        this.logger.warn(`Erro ao resolver tenant para host ${host}: ${String(error)}`);
      }
    }
    if (!tenant) {
      try {
        tenant = await this.resolveFromHeader(request);
      } catch (error) {
        this.logger.warn(`Erro ao resolver tenant por X-Tenant-Id: ${String(error)}`);
      }
    }
    if (tenant) {
      request.resolvedTenant = tenant;
    }

    next();
  }

  /**
   * Fallback quando o Host nao resolve (ex.: localhost em dev).
   * Usa header X-Tenant-Id e so popula resolvedTenant se o tenant existir.
   */
  private async resolveFromHeader(request: FastifyRequest): Promise<Tenant | null> {
    const raw = request.headers["x-tenant-id"];
    const id = Array.isArray(raw) ? raw[0] : raw;
    if (typeof id !== "string" || !id.trim()) return null;
    return this.tenancyBrandingService.getTenantOrNull(id.trim());
  }

  private async resolve(host: string): Promise<Tenant | null> {
    const parsed = parseHostForTenant(host);
    if (!parsed) return null;
    if (parsed.type === "subdomain") {
      return this.tenancyBrandingService.resolveBySubdomain(parsed.subdomain);
    }
    return this.tenancyBrandingService.resolveByDomain(parsed.domain);
  }

  private extractHost(request: FastifyRequest): string | null {
    const forwarded = request.headers["x-forwarded-host"];
    const forwardedHost = Array.isArray(forwarded) ? forwarded[0] : forwarded;
    const raw = forwardedHost ?? request.headers.host;
    if (!raw) return null;
    return raw.split(":")[0].toLowerCase().trim();
  }
}
