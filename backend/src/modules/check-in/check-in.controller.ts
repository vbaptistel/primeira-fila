import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { FastifyRequest } from "fastify";
import { AuthPrincipal } from "../../common/auth/auth.types";
import { TenantRbacGuard } from "../../common/auth/tenant-rbac.guard";
import { TenantRoles } from "../../common/auth/roles.decorator";
import { ValidateCheckInDto } from "./dto/validate-check-in.dto";
import { CheckInService } from "./check-in.service";

@ApiTags("check-in")
@Controller("check-in")
@UseGuards(TenantRbacGuard)
@TenantRoles("operator", "organizer_admin", "platform_admin")
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post()
  validateCheckIn(
    @Body() dto: ValidateCheckInDto,
    @Req() request: FastifyRequest & { authPrincipal?: AuthPrincipal }
  ) {
    return this.checkInService.validateCheckIn(dto.qrCode, request.authPrincipal?.userId);
  }
}
