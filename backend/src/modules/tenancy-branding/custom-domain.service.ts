import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { VercelApiClient, type DnsInstruction } from "./vercel-api.client";

type DomainStatusOutput = {
  domain: string | null;
  status: string | null;
  verifiedAt: Date | null;
  dnsInstructions: DnsInstruction[] | null;
};

@Injectable()
export class CustomDomainService {
  private readonly logger = new Logger(CustomDomainService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyBrandingService: TenancyBrandingService,
    private readonly vercel: VercelApiClient
  ) {}

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

    if (this.vercel.isConfigured()) {
      try {
        await this.vercel.addDomainToProject(domain);
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
    if (!this.vercel.isConfigured()) {
      throw new BadRequestException(
        "Configuracao Vercel ausente. Configure VERCEL_TOKEN e VERCEL_WEB_CUSTOMER_PROJECT_ID para usar dominios customizados."
      );
    }
    const { dnsInstructions } = await this.vercel.getDomainConfig(domain);
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

    if (this.vercel.isConfigured()) {
      try {
        await this.vercel.removeDomainFromProject(domain);
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

    if (!this.vercel.isConfigured()) {
      return await this.buildDomainStatus(
        tenant.customDomain,
        tenant.customDomainStatus ?? "PENDING_VERIFICATION",
        tenant.customDomainVerifiedAt
      );
    }

    try {
      const { verified, dnsInstructions } = await this.vercel.getDomainConfig(
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
