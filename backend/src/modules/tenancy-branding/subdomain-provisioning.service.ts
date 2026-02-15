import { Injectable, Logger } from "@nestjs/common";
import { Tenant } from "../../generated/prisma/client";
import { getPlatformBaseDomains } from "../../common/tenancy/tenant-resolver.utils";
import { VercelApiClient } from "./vercel-api.client";

/**
 * Provisiona subdomínio da plataforma na Vercel ao criar tenant:
 * 1. Adiciona {subdomain}.{baseDomain} ao projeto Vercel do web-customer
 * 2. Obtém alvo CNAME recomendado
 * 3. Cria registro CNAME na zona do domínio base via Vercel DNS (se zona estiver na Vercel)
 *
 * Falhas não bloqueiam a criação do tenant; apenas são logadas.
 */
@Injectable()
export class SubdomainProvisioningService {
  private readonly logger = new Logger(SubdomainProvisioningService.name);

  constructor(private readonly vercel: VercelApiClient) {}

  /**
   * Configura subdomínio na Vercel e, se possível, cria o registro DNS na zona (Vercel DNS).
   * Não lança: erros são apenas logados.
   */
  async provisionSubdomain(tenant: Tenant): Promise<void> {
    if (!tenant.subdomain?.trim()) return;

    if (!this.vercel.isConfigured()) {
      return;
    }

    const baseDomain = this.getSubdomainBaseDomain();
    const subdomainHost = `${tenant.subdomain.trim().toLowerCase()}.${baseDomain}`;

    try {
      await this.vercel.addDomainToProject(subdomainHost);
      this.logger.log(
        `Subdominio ${subdomainHost} adicionado ao projeto Vercel para tenant ${tenant.id}.`
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao adicionar subdominio ${subdomainHost} na Vercel para tenant ${tenant.id}: ${String(error)}`
      );
      return;
    }

    let cnameTarget: string | null = null;
    try {
      const config = await this.vercel.getDomainConfig(subdomainHost);
      cnameTarget = config.recommendedCnameValue;
    } catch (error) {
      this.logger.warn(
        `Falha ao obter config do dominio ${subdomainHost} na Vercel: ${String(error)}`
      );
      return;
    }

    if (!cnameTarget) {
      this.logger.warn(
        `Vercel nao retornou CNAME recomendado para ${subdomainHost}; registro DNS nao criado.`
      );
      return;
    }

    try {
      await this.vercel.createDnsRecord(baseDomain, {
        type: "CNAME",
        name: tenant.subdomain.trim().toLowerCase(),
        value: cnameTarget
      });
      this.logger.log(
        `Registro CNAME ${tenant.subdomain}.${baseDomain} criado na zona Vercel DNS para tenant ${tenant.id}.`
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao criar registro DNS para ${subdomainHost} (tenant ${tenant.id}). ` +
          `Se o dominio base nao esta no Vercel DNS, configure o CNAME manualmente: ${String(error)}`
      );
    }
  }

  private getSubdomainBaseDomain(): string {
    const env = process.env.PLATFORM_SUBDOMAIN_BASE_DOMAIN;
    if (env?.trim()) {
      return env.trim().toLowerCase();
    }
    const domains = getPlatformBaseDomains();
    return domains[0] ?? "primeirafila.app";
  }
}
