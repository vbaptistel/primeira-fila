import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { TenancyBrandingService } from "../tenancy-branding/tenancy-branding.service";
import {
  SupabaseAdminUsersService,
  type CreatedUser
} from "../../common/auth/supabase-admin-users.service";
import { CreateTenantUserDto } from "./dto/create-tenant-user.dto";
import { UpdateTenantUserDto } from "./dto/update-tenant-user.dto";
import { AppRole } from "../../common/auth/auth.types";

const DEFAULT_MAX_USERS_ENV = "TENANT_MAX_USERS_DEFAULT";
const DEFAULT_MAX_USERS_FALLBACK = 50;

export type TenantUserOutput = {
  id: string;
  authUserId: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: Date;
};

@Injectable()
export class TenantUsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenancyBrandingService: TenancyBrandingService,
    private readonly supabaseAdminUsers: SupabaseAdminUsersService
  ) {}

  private getDefaultMaxUsers(): number {
    const raw = process.env[DEFAULT_MAX_USERS_ENV];
    if (raw === undefined || raw === "") return DEFAULT_MAX_USERS_FALLBACK;
    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < 1) return DEFAULT_MAX_USERS_FALLBACK;
    return n;
  }

  async createUser(
    tenantId: string,
    dto: CreateTenantUserDto,
    actorRole: AppRole,
    actorTenantId: string | undefined
  ): Promise<CreatedUser & { email: string }> {
    const tenant = await this.tenancyBrandingService.getTenant(tenantId);

    if (actorRole !== "platform_admin" && actorTenantId !== tenantId) {
      throw new BadRequestException("Apenas platform_admin pode criar usuarios em outro tenant.");
    }

    const role = dto.role as AppRole;
    const count = await this.prisma.tenantMember.count({ where: { tenantId } });
    const limit = tenant.maxUsers ?? this.getDefaultMaxUsers();
    if (count >= limit) {
      throw new BadRequestException("USER_LIMIT_EXCEEDED");
    }

    try {
      const created = await this.supabaseAdminUsers.createUser({
        email: dto.email,
        password: dto.password,
        role,
        tenantId,
        displayName: dto.displayName
      });

      await this.prisma.tenantMember.create({
        data: {
          tenantId,
          authUserId: created.id,
          email: created.email ?? dto.email,
          displayName: dto.displayName?.trim() ?? null,
          role: created.role
        }
      });

      return {
        ...created,
        email: created.email ?? dto.email,
        displayName: created.displayName
      };
    } catch (err) {
      if (err instanceof ConflictException) {
        if (err.message.includes("ja existe")) {
          throw new ConflictException("USER_ALREADY_EXISTS");
        }
        throw err;
      }
      throw err;
    }
  }

  async listUsers(tenantId: string): Promise<TenantUserOutput[]> {
    await this.tenancyBrandingService.getTenant(tenantId);

    const members = await this.prisma.tenantMember.findMany({
      where: { tenantId },
      orderBy: { createdAt: "asc" }
    });

    return members.map((m) => ({
      id: m.id,
      authUserId: m.authUserId,
      email: m.email,
      displayName: m.displayName,
      role: m.role,
      createdAt: m.createdAt
    }));
  }

  async updateUserRole(
    tenantId: string,
    userId: string,
    dto: UpdateTenantUserDto
  ): Promise<TenantUserOutput> {
    await this.tenancyBrandingService.getTenant(tenantId);

    const member = await this.prisma.tenantMember.findFirst({
      where: { tenantId, authUserId: userId }
    });

    if (!member) {
      throw new NotFoundException("Usuario nao encontrado neste tenant.");
    }

    const metadata: { role?: AppRole; displayName?: string } = {};
    if (dto.role !== undefined) metadata.role = dto.role as AppRole;
    if (dto.displayName !== undefined) metadata.displayName = dto.displayName;
    if (Object.keys(metadata).length > 0) {
      await this.supabaseAdminUsers.updateUserMetadata(userId, metadata);
    }

    const updateData: { role?: string; displayName?: string | null } = {};
    if (dto.role !== undefined) updateData.role = dto.role;
    if (dto.displayName !== undefined) updateData.displayName = dto.displayName.trim() || null;

    const updated =
      Object.keys(updateData).length > 0
        ? await this.prisma.tenantMember.update({
            where: { id: member.id },
            data: updateData
          })
        : member;

    return {
      id: updated.id,
      authUserId: updated.authUserId,
      email: updated.email,
      displayName: updated.displayName,
      role: updated.role,
      createdAt: updated.createdAt
    };
  }
}
