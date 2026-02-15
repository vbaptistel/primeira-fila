import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import { Tenant } from "../../generated/prisma/client";
import { TenancyBrandingService } from "../../modules/tenancy-branding/tenancy-branding.service";

const DEFAULT_BASE_DOMAIN = "primeira-fila.com";

export type TenantAwareRequest = FastifyRequest & {
  resolvedTenant?: Tenant;
};

/**
 * Middleware que resolve o tenant a partir do header Host.
 *
 * Logica de resolucao:
 * 1. Se o host e um subdominio do dominio base (e.g. acme.primeira-fila.com),
 *    extrai o subdomain e busca por subdomain.
 * 2. Se o host nao pertence ao dominio base, trata como dominio customizado
 *    e busca por customDomain (somente VERIFIED).
 * 3. Se o host e o dominio base puro ou nao ha host, nao resolve
 *    (rotas admin usam tenantId do JWT).
 *
 * O middleware apenas popula request.resolvedTenant e nunca bloqueia.
 * Cabe aos controllers/guards decidir se o tenant e obrigatorio.
 */
@Injectable()
export class TenantResolverMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantResolverMiddleware.name);
  private readonly baseDomain: string;

  constructor(private readonly tenancyBrandingService: TenancyBrandingService) {
    this.baseDomain = (process.env.PLATFORM_BASE_DOMAIN ?? DEFAULT_BASE_DOMAIN).toLowerCase();
  }

  async use(
    request: TenantAwareRequest,
    _reply: FastifyReply,
    next: () => void
  ): Promise<void> {
    const host = this.extractHost(request);

    if (!host) {
      next();
      return;
    }

    try {
      const tenant = await this.resolve(host);
      if (tenant) {
        request.resolvedTenant = tenant;
      }
    } catch (error) {
      this.logger.warn(`Erro ao resolver tenant para host ${host}: ${String(error)}`);
    }

    next();
  }

  private async resolve(host: string): Promise<Tenant | null> {
    // Verifica se o host pertence ao dominio base
    if (this.belongsToBaseDomain(host)) {
      const subdomain = this.extractSubdomain(host);
      if (subdomain) {
        return this.tenancyBrandingService.resolveBySubdomain(subdomain);
      }
      // Dominio base puro, www, ou subdominio multi-nivel: nao resolve
      return null;
    }

    // Host externo ao dominio base: tenta como dominio customizado
    return this.tenancyBrandingService.resolveByDomain(host);
  }

  private extractHost(request: FastifyRequest): string | null {
    // X-Forwarded-Host e usado por reverse proxies (Vercel)
    const forwarded = request.headers["x-forwarded-host"];
    const forwardedHost = Array.isArray(forwarded) ? forwarded[0] : forwarded;

    const raw = forwardedHost ?? request.headers.host;
    if (!raw) return null;

    // Remove porta se presente
    return raw.split(":")[0].toLowerCase().trim();
  }

  private extractSubdomain(host: string): string | null {
    const suffix = `.${this.baseDomain}`;

    if (!host.endsWith(suffix)) {
      return null;
    }

    const subdomain = host.slice(0, -suffix.length);

    // Ignora subdominios vazios ou com niveis extras (e.g. a.b.primeira-fila.com)
    if (!subdomain || subdomain.includes(".")) {
      return null;
    }

    return subdomain;
  }

  private belongsToBaseDomain(host: string): boolean {
    return host === this.baseDomain || host.endsWith(`.${this.baseDomain}`);
  }
}
