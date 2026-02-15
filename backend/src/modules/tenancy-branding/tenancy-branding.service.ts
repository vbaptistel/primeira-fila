import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException
} from "@nestjs/common";
import { Tenant } from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";

type CacheEntry = {
  tenant: Tenant;
  expiresAt: number;
};

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos

@Injectable()
export class TenancyBrandingService {
  private readonly logger = new Logger(TenancyBrandingService.name);
  private readonly subdomainCache = new Map<string, CacheEntry>();
  private readonly domainCache = new Map<string, CacheEntry>();

  constructor(private readonly prisma: PrismaService) {}

  async createTenant(dto: CreateTenantDto): Promise<Tenant> {
    try {
      return await this.prisma.tenant.create({
        data: {
          id: dto.id,
          name: dto.name,
          slug: dto.slug,
          subdomain: dto.subdomain,
          logoUrl: dto.logoUrl,
          faviconUrl: dto.faviconUrl,
          primaryColor: dto.primaryColor ?? "#000000",
          secondaryColor: dto.secondaryColor ?? "#FFFFFF",
          accentColor: dto.accentColor ?? "#3B82F6",
          footerText: dto.footerText,
          termsUrl: dto.termsUrl,
          privacyUrl: dto.privacyUrl,
          socialLinks: dto.socialLinks ?? undefined,
          isActive: dto.isActive ?? true
        }
      });
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          "Tenant com este id, slug ou subdomain ja existe."
        );
      }
      throw error;
    }
  }

  async getTenant(tenantId: string): Promise<Tenant> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant nao encontrado.");
    }

    return tenant;
  }

  async getTenantOrNull(tenantId: string): Promise<Tenant | null> {
    return this.prisma.tenant.findUnique({
      where: { id: tenantId }
    });
  }

  async updateTenant(tenantId: string, dto: UpdateTenantDto): Promise<Tenant> {
    await this.getTenant(tenantId);

    try {
      const updated = await this.prisma.tenant.update({
        where: { id: tenantId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.slug !== undefined && { slug: dto.slug }),
          ...(dto.subdomain !== undefined && { subdomain: dto.subdomain }),
          ...(dto.logoUrl !== undefined && { logoUrl: dto.logoUrl }),
          ...(dto.faviconUrl !== undefined && { faviconUrl: dto.faviconUrl }),
          ...(dto.primaryColor !== undefined && { primaryColor: dto.primaryColor }),
          ...(dto.secondaryColor !== undefined && { secondaryColor: dto.secondaryColor }),
          ...(dto.accentColor !== undefined && { accentColor: dto.accentColor }),
          ...(dto.footerText !== undefined && { footerText: dto.footerText }),
          ...(dto.termsUrl !== undefined && { termsUrl: dto.termsUrl }),
          ...(dto.privacyUrl !== undefined && { privacyUrl: dto.privacyUrl }),
          ...(dto.socialLinks !== undefined && { socialLinks: dto.socialLinks }),
          ...(dto.isActive !== undefined && { isActive: dto.isActive })
        }
      });

      this.invalidateCache(updated);
      return updated;
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException(
          "Slug ou subdomain ja esta em uso por outro tenant."
        );
      }
      throw error;
    }
  }

  async resolveBySubdomain(subdomain: string): Promise<Tenant | null> {
    const cached = this.subdomainCache.get(subdomain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { subdomain }
    });

    if (tenant && tenant.isActive) {
      this.subdomainCache.set(subdomain, {
        tenant,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return tenant;
    }

    this.subdomainCache.delete(subdomain);
    return null;
  }

  async resolveByDomain(domain: string): Promise<Tenant | null> {
    const cached = this.domainCache.get(domain);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.tenant;
    }

    const tenant = await this.prisma.tenant.findUnique({
      where: { customDomain: domain }
    });

    if (tenant && tenant.isActive && tenant.customDomainStatus === "VERIFIED") {
      this.domainCache.set(domain, {
        tenant,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return tenant;
    }

    this.domainCache.delete(domain);
    return null;
  }

  getPublicBranding(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      footerText: tenant.footerText,
      termsUrl: tenant.termsUrl,
      privacyUrl: tenant.privacyUrl,
      socialLinks: tenant.socialLinks,
      customDomain: tenant.customDomain
    };
  }

  toOutput(tenant: Tenant) {
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      subdomain: tenant.subdomain,
      logoUrl: tenant.logoUrl,
      faviconUrl: tenant.faviconUrl,
      primaryColor: tenant.primaryColor,
      secondaryColor: tenant.secondaryColor,
      accentColor: tenant.accentColor,
      footerText: tenant.footerText,
      termsUrl: tenant.termsUrl,
      privacyUrl: tenant.privacyUrl,
      socialLinks: tenant.socialLinks,
      isActive: tenant.isActive,
      customDomain: tenant.customDomain,
      customDomainStatus: tenant.customDomainStatus,
      customDomainVerifiedAt: tenant.customDomainVerifiedAt,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt
    };
  }

  invalidateCache(tenant: Tenant): void {
    this.subdomainCache.delete(tenant.subdomain);
    if (tenant.customDomain) {
      this.domainCache.delete(tenant.customDomain);
    }
  }

  private isPrismaErrorCode(error: unknown, code: string): boolean {
    if (typeof error !== "object" || error === null) return false;
    return "code" in error && (error as { code?: string }).code === code;
  }
}
