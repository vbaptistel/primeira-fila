import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import { Tenant } from "../../generated/prisma/client";
import { TenantAwareRequest } from "./tenant-resolver.guard";

export const ResolvedTenant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Tenant | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantAwareRequest>();
    return request.resolvedTenant;
  }
);

export const ResolvedTenantId = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<TenantAwareRequest>();
    return request.resolvedTenant?.id;
  }
);
