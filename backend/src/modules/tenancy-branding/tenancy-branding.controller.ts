
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { parseHostForTenant } from "../../common/tenancy/tenant-resolver.utils";
import { CustomDomainService } from "./custom-domain.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { SetCustomDomainDto } from "./dto/set-custom-domain.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { TenancyBrandingService } from "./tenancy-branding.service";

@ApiTags("tenancy-branding")
@Controller()
export class TenancyBrandingController {
  constructor(
    private readonly tenancyBrandingService: TenancyBrandingService,
    private readonly customDomainService: CustomDomainService
  ) { }

  // --- Rotas autenticadas (backoffice) ---

  @Post("tenants")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("platform_admin")
  async createTenant(@Body() dto: CreateTenantDto) {
    const tenant = await this.tenancyBrandingService.createTenant(dto);
    return this.tenancyBrandingService.toOutput(tenant);
  }

  @Get("tenants")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("platform_admin")
  async listTenants(
    @Query("limit") limit?: string,
    @Query("cursor") cursor?: string
  ) {
    const limitNum = limit ? Math.min(Math.max(1, parseInt(limit, 10) || 20), 100) : 20;
    const { items, nextCursor } = await this.tenancyBrandingService.listTenants(
      limitNum,
      cursor
    );
    return {
      items: items.map((t) => this.tenancyBrandingService.toOutput(t)),
      nextCursor: nextCursor ?? null
    };
  }

  @Get("tenants/:tenantId")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async getTenant(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);
    return this.tenancyBrandingService.toOutput(tenant);
  }

  @Patch("tenants/:tenantId")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async updateTenant(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: UpdateTenantDto
  ) {
    const tenant = await this.tenancyBrandingService.updateTenant(tenantId, dto);
    return this.tenancyBrandingService.toOutput(tenant);
  }

  @Post("tenants/:tenantId/upload/logo")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async uploadLogo(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Req() req: FastifyRequest
  ) {
    const file = await (req as any).file();
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const buffer = await file.toBuffer();
    return this.tenancyBrandingService.uploadLogo(tenantId, buffer, file.mimetype);
  }

  @Post("tenants/:tenantId/upload/favicon")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async uploadFavicon(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Req() req: FastifyRequest
  ) {
    const file = await (req as any).file();
    if (!file) {
      throw new BadRequestException("File is required");
    }
    const buffer = await file.toBuffer();
    return this.tenancyBrandingService.uploadFavicon(tenantId, buffer, file.mimetype);
  }

  // --- Custom domain ---

  @Put("tenants/:tenantId/custom-domain")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async setCustomDomain(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: SetCustomDomainDto
  ) {
    return this.customDomainService.addDomain(tenantId, dto.domain);
  }

  @Delete("tenants/:tenantId/custom-domain")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeCustomDomain(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    await this.customDomainService.removeDomain(tenantId);
  }

  @Post("tenants/:tenantId/custom-domain/verify")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async verifyCustomDomain(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.customDomainService.verifyDomain(tenantId);
  }

  @Get("tenants/:tenantId/custom-domain/status")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("organizer_admin", "platform_admin")
  async getCustomDomainStatus(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.customDomainService.getDomainStatus(tenantId);
  }

  // --- Rotas publicas (web-customer SSR) ---

  @Get("public/tenants/resolve")
  async resolveTenant(
    @Query("subdomain") subdomain?: string,
    @Query("domain") domain?: string
  ) {
    if (subdomain) {
      const tenant = await this.tenancyBrandingService.resolveBySubdomain(subdomain);
      if (!tenant) {
        return { found: false, tenant: null };
      }
      return { found: true, tenant: this.tenancyBrandingService.getPublicBranding(tenant) };
    }

    if (domain) {
      const parsed = parseHostForTenant(domain);
      if (parsed?.type === "subdomain") {
        const tenant = await this.tenancyBrandingService.resolveBySubdomain(parsed.subdomain);
        if (!tenant) {
          return { found: false, tenant: null };
        }
        return { found: true, tenant: this.tenancyBrandingService.getPublicBranding(tenant) };
      }
      if (parsed?.type === "custom") {
        const tenant = await this.tenancyBrandingService.resolveByDomain(parsed.domain);
        if (!tenant) {
          return { found: false, tenant: null };
        }
        return { found: true, tenant: this.tenancyBrandingService.getPublicBranding(tenant) };
      }
    }

    return { found: false, tenant: null };
  }

  /** Retorna branding por tenantId. Usado em dev local (localhost + NEXT_PUBLIC_DEV_TENANT_ID). */
  @Get("public/tenants/by-id/:tenantId")
  async getPublicTenantById(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    const tenant = await this.tenancyBrandingService.getTenantOrNull(tenantId);
    if (!tenant || !tenant.isActive) {
      return { found: false, tenant: null };
    }
    return { found: true, tenant: this.tenancyBrandingService.getPublicBranding(tenant) };
  }
}
