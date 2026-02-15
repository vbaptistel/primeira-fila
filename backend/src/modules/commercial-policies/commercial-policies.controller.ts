import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { CreateCommercialPolicyVersionDto } from "./dto/create-commercial-policy-version.dto";
import { CommercialPoliciesService } from "./commercial-policies.service";

@ApiTags("commercial-policy")
@UseGuards(TenantRbacGuard)
@TenantRoles("organizer_admin", "platform_admin")
@Controller("tenants/:tenantId/commercial-policy")
export class CommercialPoliciesController {
  constructor(private readonly commercialPoliciesService: CommercialPoliciesService) {}

  @Get()
  getTenantCommercialPolicy(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.commercialPoliciesService.getTenantCommercialPolicy(tenantId);
  }

  @Post("versions")
  createPolicyVersion(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateCommercialPolicyVersionDto
  ) {
    return this.commercialPoliciesService.createPolicyVersion(tenantId, dto);
  }
}
