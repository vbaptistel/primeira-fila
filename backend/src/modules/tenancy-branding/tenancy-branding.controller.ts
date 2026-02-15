import {
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
  UseGuards
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { parseHostForTenant } from "../../common/tenancy/tenant-resolver.utils";
import { TenancyBrandingService } from "./tenancy-branding.service";
import { CustomDomainService } from "./custom-domain.service";
import { CreateTenantDto } from "./dto/create-tenant.dto";
import { UpdateTenantDto } from "./dto/update-tenant.dto";
import { SetCustomDomainDto } from "./dto/set-custom-domain.dto";

@ApiTags("tenancy-branding")
@Controller()
export class TenancyBrandingController {
  constructor(
    private readonly tenancyBrandingService: TenancyBrandingService,
    private readonly customDomainService: CustomDomainService
  ) {}

  // --- Rotas autenticadas (backoffice) ---

  @Post("tenants")
  @UseGuards(TenantRbacGuard)
  @TenantRoles("platform_admin")
  async createTenant(@Body() dto: CreateTenantDto) {
    const tenant = await this.tenancyBrandingService.createTenant(dto);
    return this.tenancyBrandingService.toOutput(tenant);
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
}
