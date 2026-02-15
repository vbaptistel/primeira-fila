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

type VercelDomainConfigResponse = {
  configuredBy: "CNAME" | "A" | "http" | "dns-01" | null;
  acceptedChallenges?: string[];
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  misconfigured: boolean;
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
    this.vercelProjectId = process.env.VERCEL_WEB_CUSTOMER_PROJECT_ID;
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

    return await this.buildDomainStatus(domain, "PENDING_VERIFICATION", null);
  }

  async getDnsInstructions(domain: string): Promise<DnsInstruction[]> {
    if (!this.isVercelConfigured()) {
      throw new BadRequestException(
        "Configuracao Vercel ausente. Configure VERCEL_TOKEN e VERCEL_WEB_CUSTOMER_PROJECT_ID para usar dominios customizados."
      );
    }
    const { dnsInstructions } = await this.vercelGetDomainConfig(domain);
    return dnsInstructions;
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
      return await this.buildDomainStatus(
        tenant.customDomain,
        "VERIFIED",
        tenant.customDomainVerifiedAt
      );
    }

    if (!this.isVercelConfigured()) {
      return await this.buildDomainStatus(
        tenant.customDomain,
        tenant.customDomainStatus ?? "PENDING_VERIFICATION",
        tenant.customDomainVerifiedAt
      );
    }

    try {
      const { verified, dnsInstructions } = await this.vercelGetDomainConfig(
        tenant.customDomain
      );

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

        return await this.buildDomainStatus(tenant.customDomain, "VERIFIED", now);
      }

      if (tenant.customDomainStatus !== "PENDING_VERIFICATION") {
        await this.prisma.tenant.update({
          where: { id: tenantId },
          data: { customDomainStatus: "PENDING_VERIFICATION" }
        });
      }

      return await this.buildDomainStatus(
        tenant.customDomain,
        "PENDING_VERIFICATION",
        null,
        dnsInstructions
      );
    } catch (error) {
      this.logger.warn(
        `Falha ao verificar dominio ${tenant.customDomain} na Vercel: ${String(error)}`
      );

      await this.prisma.tenant.update({
        where: { id: tenantId },
        data: { customDomainStatus: "FAILED" }
      });

      return await this.buildDomainStatus(
        tenant.customDomain,
        "FAILED",
        null,
        []
      );
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

    return await this.buildDomainStatus(
      tenant.customDomain,
      tenant.customDomainStatus ?? "PENDING_VERIFICATION",
      tenant.customDomainVerifiedAt
    );
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

  private async vercelGetDomainConfig(
    domain: string
  ): Promise<{
    verified: boolean;
    dnsInstructions: DnsInstruction[];
  }> {
    const path = `/v6/domains/${encodeURIComponent(domain)}/config`;
    const url = this.buildVercelUrl(
      path,
      this.vercelProjectId ? { projectIdOrName: this.vercelProjectId } : undefined
    );

    const response = await fetch(url, {
      method: "GET",
      headers: this.buildVercelHeaders()
    });

    if (!response.ok) {
      throw new Error(`Vercel getDomainConfig falhou (${response.status}): ${await response.text()}`);
    }

    const data = (await response.json()) as VercelDomainConfigResponse;
    const verified = data.misconfigured === false;

    const dnsInstructions = this.buildDnsInstructionsFromConfig(domain, data);
    return { verified, dnsInstructions };
  }

  private buildDnsInstructionsFromConfig(
    domain: string,
    config: VercelDomainConfigResponse
  ): DnsInstruction[] {
    const instructions: DnsInstruction[] = [];

    const cnameRank1 = config.recommendedCNAME?.find((r) => r.rank === 1);
    if (cnameRank1?.value) {
      instructions.push({
        type: "CNAME",
        name: domain,
        value: cnameRank1.value,
        purpose: "Apontar o dominio para a Vercel. Configure este registro no seu provedor de DNS."
      });
    }

    const ipv4Rank1 = config.recommendedIPv4?.find((r) => r.rank === 1);
    if (ipv4Rank1?.value?.length) {
      const value = Array.isArray(ipv4Rank1.value)
        ? ipv4Rank1.value[0]
        : String(ipv4Rank1.value);
      instructions.push({
        type: "A",
        name: domain,
        value,
        purpose: "Apontar o dominio para a Vercel. Configure este registro no seu provedor de DNS."
      });
    }

    if (instructions.length === 0) {
      throw new Error(
        `Vercel nao retornou instrucoes DNS (CNAME ou A) para o dominio ${domain}.`
      );
    }
    return instructions;
  }

  private buildVercelUrl(
    path: string,
    extraParams?: Record<string, string>
  ): string {
    const base = "https://api.vercel.com";
    const params = new URLSearchParams();
    if (this.vercelTeamId) params.set("teamId", this.vercelTeamId);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return `${base}${path}${query}`;
  }

  private buildVercelHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.vercelToken}`,
      "Content-Type": "application/json"
    };
  }

  private async buildDomainStatus(
    domain: string,
    status: string,
    verifiedAt: Date | null,
    dnsInstructionsOverride?: DnsInstruction[] | null
  ): Promise<DomainStatusOutput> {
    const dnsInstructions =
      status === "VERIFIED"
        ? null
        : (dnsInstructionsOverride ?? (await this.getDnsInstructions(domain)));

    return {
      domain,
      status,
      verifiedAt,
      dnsInstructions
    };
  }
}
