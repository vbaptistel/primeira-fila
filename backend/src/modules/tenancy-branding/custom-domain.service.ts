import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { TenancyBrandingService } from "./tenancy-branding.service";

type DomainStatusOutput = {
  domain: string | null;
  status: string | null;
  verifiedAt: Date | null;
  dnsInstructions: DnsInstruction[] | null;
};

type DnsInstruction = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

@Injectable()
export class CustomDomainService {
  private readonly logger = new Logger(CustomDomainService.name);

  private readonly vercelToken: string | undefined;
  private readonly vercelTeamId: string | undefined;
  private readonly vercelProjectId: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyBrandingService: TenancyBrandingService
  ) {
    this.vercelToken = process.env.VERCEL_TOKEN;
    this.vercelTeamId = process.env.VERCEL_TEAM_ID;
    this.vercelProjectId = process.env.VERCEL_PROJECT_ID;
  }

  async addDomain(tenantId: string, domain: string): Promise<DomainStatusOutput> {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);

    if (tenant.customDomain && tenant.customDomain !== domain) {
      throw new BadRequestException(
        `Tenant ja possui dominio customizado configurado: ${tenant.customDomain}. Remova-o antes de adicionar outro.`
      );
    }

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        customDomain: domain,
        customDomainStatus: "PENDING_VERIFICATION",
        customDomainVerifiedAt: null
      }
    });

    this.tenancyBrandingService.invalidateCache(tenant);

    if (this.isVercelConfigured()) {
      try {
        await this.vercelAddDomain(domain);
        this.logger.log(`Dominio ${domain} adicionado ao projeto Vercel para tenant ${tenantId}.`);
      } catch (error) {
        this.logger.warn(
          `Falha ao adicionar dominio ${domain} na Vercel para tenant ${tenantId}: ${String(error)}`
        );
      }
    }

    return this.buildDomainStatus(domain, "PENDING_VERIFICATION", null);
  }

  async removeDomain(tenantId: string): Promise<void> {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);

    if (!tenant.customDomain) {
      throw new NotFoundException("Tenant nao possui dominio customizado configurado.");
    }

    const domain = tenant.customDomain;

    await this.prisma.tenant.update({
      where: { id: tenantId },
      data: {
        customDomain: null,
        customDomainStatus: null,
        customDomainVerifiedAt: null
      }
    });

    this.tenancyBrandingService.invalidateCache(tenant);

    if (this.isVercelConfigured()) {
      try {
        await this.vercelRemoveDomain(domain);
        this.logger.log(`Dominio ${domain} removido do projeto Vercel para tenant ${tenantId}.`);
      } catch (error) {
        this.logger.warn(
          `Falha ao remover dominio ${domain} da Vercel para tenant ${tenantId}: ${String(error)}`
        );
      }
    }
  }

  async verifyDomain(tenantId: string): Promise<DomainStatusOutput> {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);

    if (!tenant.customDomain) {
      throw new NotFoundException("Tenant nao possui dominio customizado configurado.");
    }

    if (tenant.customDomainStatus === "VERIFIED") {
      return this.buildDomainStatus(
        tenant.customDomain,
        "VERIFIED",
        tenant.customDomainVerifiedAt
      );
    }

    if (!this.isVercelConfigured()) {
      return this.buildDomainStatus(
        tenant.customDomain,
        tenant.customDomainStatus ?? "PENDING_VERIFICATION",
        tenant.customDomainVerifiedAt
      );
    }

    try {
      const verified = await this.vercelVerifyDomain(tenant.customDomain);

      if (verified) {
        const now = new Date();
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: {
            customDomainStatus: "VERIFIED",
            customDomainVerifiedAt: now
          }
        });

        this.tenancyBrandingService.invalidateCache(tenant);

        this.logger.log(
          `Dominio ${tenant.customDomain} verificado com sucesso para tenant ${tenantId}.`
        );

        return this.buildDomainStatus(tenant.customDomain, "VERIFIED", now);
      }

      if (tenant.customDomainStatus !== "PENDING_VERIFICATION") {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { customDomainStatus: "PENDING_VERIFICATION" }
        });
      }

      return this.buildDomainStatus(
        tenant.customDomain,
        "PENDING_VERIFICATION",
        null
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar dominio ${tenant.customDomain} na Vercel: ${String(error)}`
      );

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { customDomainStatus: "FAILED" }
      });

      return this.buildDomainStatus(tenant.customDomain, "FAILED", null);
    }
  }

  async getDomainStatus(tenantId: string): Promise<DomainStatusOutput> {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);

    if (!tenant.customDomain) {
      return {
        domain: null,
        status: null,
        verifiedAt: null,
        dnsInstructions: null
      };
    }

    return this.buildDomainStatus(
      tenant.customDomain,
      tenant.customDomainStatus ?? "PENDING_VERIFICATION",
      tenant.customDomainVerifiedAt
    );
  }

  getDnsInstructions(domain: string): DnsInstruction[] {
    return [
      {
        type: "CNAME",
        name: domain,
        value: "cname.vercel-dns.com",
        purpose: "Apontar o dominio para a Vercel. Configure este registro no seu provedor de DNS."
      }
    ];
  }

  // --- Vercel SDK integration ---

  private isVercelConfigured(): boolean {
    return Boolean(this.vercelToken && this.vercelProjectId);
  }

  private async vercelAddDomain(domain: string): Promise<void> {
    const url = this.buildVercelUrl(`/v10/projects/${this.vercelProjectId}/domains`);

    const response = await fetch(url, {
      method: "POST",
      headers: this.buildVercelHeaders(),
      body: JSON.stringify({ name: domain })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vercel addDomain falhou (${response.status}): ${body}`);
    }
  }

  private async vercelRemoveDomain(domain: string): Promise<void> {
    const url = this.buildVercelUrl(
      `/v9/projects/${this.vercelProjectId}/domains/${encodeURIComponent(domain)}`
    );

    const response = await fetch(url, {
      method: "DELETE",
      headers: this.buildVercelHeaders()
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vercel removeDomain falhou (${response.status}): ${body}`);
    }
  }

  private async vercelVerifyDomain(domain: string): Promise<boolean> {
    const url = this.buildVercelUrl(
      `/v9/projects/${this.vercelProjectId}/domains/${encodeURIComponent(domain)}/verify`
    );

    const response = await fetch(url, {
      method: "POST",
      headers: this.buildVercelHeaders()
    });

    if (!response.ok) {
      return false;
    }

    const data = (await response.json()) as { verified?: boolean };
    return data.verified === true;
  }

  private buildVercelUrl(path: string): string {
    const base = "https://api.vercel.com";
    const teamParam = this.vercelTeamId ? `?teamId=${this.vercelTeamId}` : "";
    return `${base}${path}${teamParam}`;
  }

  private buildVercelHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.vercelToken}`,
      "Content-Type": "application/json"
    };
  }

  private buildDomainStatus(
    domain: string,
    status: string,
    verifiedAt: Date | null
  ): DomainStatusOutput {
    const dnsInstructions =
      status === "VERIFIED" ? null : this.getDnsInstructions(domain);

    return {
      domain,
      status,
      verifiedAt,
      dnsInstructions
    };
  }
}
