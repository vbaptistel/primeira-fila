import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { AuthPrincipal } from "../../common/auth/auth.types";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import { UpdateTenantUserDto } from "./dto/update-tenant-user.dto";
import { TenantUsersService } from "./tenant-users.service";

type RequestWithAuth = FastifyRequest & { authPrincipal?: AuthPrincipal };

@ApiTags("tenant-users")
@Controller("tenants/:tenantId/users")
@UseGuards(TenantRbacGuard)
@TenantRoles("platform_admin", "organizer_admin")
export class TenantUsersController {
  constructor(private readonly tenantUsersService: TenantUsersService) {}

  @Post()
  async createUser(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Body() dto: CreateTenantUserDto,
    @Req() req: RequestWithAuth
  ) {
    const principal = req.authPrincipal;
    if (!principal) throw new Error("authPrincipal missing");
    const actorRole = principal.roles.includes("platform_admin")
      ? "platform_admin"
      : "organizer_admin";
    return this.tenantUsersService.createUser(
      tenantId,
      dto,
      actorRole,
      principal.tenantId
    );
  }

  @Get()
  async listUsers(@Param("tenantId", ParseUUIDPipe) tenantId: string) {
    return this.tenantUsersService.listUsers(tenantId);
  }

  @Patch(":userId")
  async updateUserRole(
    @Param("tenantId", ParseUUIDPipe) tenantId: string,
    @Param("userId", ParseUUIDPipe) userId: string,
    @Body() dto: UpdateTenantUserDto
  ) {
    return this.tenantUsersService.updateUserRole(tenantId, userId, dto);
  }
}
