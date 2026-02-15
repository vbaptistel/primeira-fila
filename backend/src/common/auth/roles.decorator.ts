import { SetMetadata } from "@nestjs/common";
import { AppRole } from "./auth.types";

export const TENANT_ROLES_KEY = "tenant_roles";

export const TenantRoles = (...roles: AppRole[]) => SetMetadata(TENANT_ROLES_KEY, roles);
