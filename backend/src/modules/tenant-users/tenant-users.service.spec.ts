import { BadRequestException, ConflictException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import { TenantUsersService } from "./tenant-users.service";
import type { PrismaService } from "../../infrastructure/prisma/prisma.service";
import type { TenancyBrandingService } from "../tenancy-branding/tenancy-branding.service";
import type { SupabaseAdminUsersService } from "../../common/auth/supabase-admin-users.service";

const mockTenancy = {
  getTenant: vi.fn(),
} as unknown as TenancyBrandingService;

const mockPrisma = {
  tenantMember: {
    count: vi.fn(),
    create: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
  },
} as unknown as PrismaService;

const mockSupabaseAdmin = {
  createUser: vi.fn(),
  updateUserMetadata: vi.fn(),
} as unknown as SupabaseAdminUsersService;

describe("TenantUsersService", () => {
  const tenantId = "00000000-0000-0000-0000-000000000001";

  beforeEach(() => {
    vi.clearAllMocks();
    mockTenancy.getTenant.mockResolvedValue({
      id: tenantId,
      maxUsers: 10,
    });
    mockPrisma.tenantMember.count.mockResolvedValue(2);
    mockSupabaseAdmin.createUser.mockResolvedValue({
      id: "auth-user-1",
      email: "novo@test.com",
      role: "operator",
      tenantId,
    });
    mockPrisma.tenantMember.create.mockResolvedValue({});
  });

  it("deve criar usuario quando platform_admin e limite nao excedido", async () => {
    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    const result = await service.createUser(
      tenantId,
      { email: "novo@test.com", password: "senha12345", role: "operator" },
      "platform_admin",
      undefined
    );

    expect(result.role).toBe("operator");
    expect(result.email).toBe("novo@test.com");
    expect(mockSupabaseAdmin.createUser).toHaveBeenCalledWith({
      email: "novo@test.com",
      password: "senha12345",
      role: "operator",
      tenantId,
      displayName: undefined,
    });
    expect(mockPrisma.tenantMember.create).toHaveBeenCalled();
  });

  it("deve lancar BadRequest quando organizer_admin tenta criar em outro tenant", async () => {
    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    await expect(
      service.createUser(
        tenantId,
        { email: "x@test.com", password: "senha12345", role: "operator" },
        "organizer_admin",
        "outro-tenant-id"
      )
    ).rejects.toThrow(BadRequestException);

    expect(mockSupabaseAdmin.createUser).not.toHaveBeenCalled();
  });

  it("deve lancar BadRequest quando limite excedido", async () => {
    mockPrisma.tenantMember.count.mockResolvedValue(10);
    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    await expect(
      service.createUser(
        tenantId,
        { email: "x@test.com", password: "senha12345", role: "operator" },
        "platform_admin",
        undefined
      )
    ).rejects.toThrow("USER_LIMIT_EXCEEDED");

    expect(mockSupabaseAdmin.createUser).not.toHaveBeenCalled();
  });

  it("deve lancar Conflict quando email ja existe", async () => {
    mockSupabaseAdmin.createUser.mockRejectedValue(
      new ConflictException("Usuario com este email ja existe.")
    );
    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    await expect(
      service.createUser(
        tenantId,
        { email: "existente@test.com", password: "senha12345", role: "operator" },
        "platform_admin",
        undefined
      )
    ).rejects.toThrow(ConflictException);
  });

  it("deve criar usuario com displayName quando informado", async () => {
    mockSupabaseAdmin.createUser.mockResolvedValue({
      id: "auth-user-2",
      email: "maria@test.com",
      role: "operator",
      tenantId,
      displayName: "Maria Silva",
    });
    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    await service.createUser(
      tenantId,
      {
        email: "maria@test.com",
        displayName: "Maria Silva",
        password: "senha12345",
        role: "operator",
      },
      "platform_admin",
      undefined
    );

    expect(mockSupabaseAdmin.createUser).toHaveBeenCalledWith({
      email: "maria@test.com",
      displayName: "Maria Silva",
      password: "senha12345",
      role: "operator",
      tenantId,
    });
    expect(mockPrisma.tenantMember.create).toHaveBeenCalledWith({
      data: {
        tenantId,
        authUserId: "auth-user-2",
        email: "maria@test.com",
        displayName: "Maria Silva",
        role: "operator",
      },
    });
  });

  it("deve listar usuarios do tenant", async () => {
    const members = [
      {
        id: "m1",
        authUserId: "u1",
        email: "a@test.com",
        displayName: "Usuario A",
        role: "organizer_admin",
        createdAt: new Date(),
      },
    ];
    mockPrisma.tenantMember.findMany.mockResolvedValue(members);

    const service = new TenantUsersService(
      mockPrisma,
      mockTenancy,
      mockSupabaseAdmin
    );

    const result = await service.listUsers(tenantId);
    expect(result).toHaveLength(1);
    expect(result[0].email).toBe("a@test.com");
    expect(result[0].displayName).toBe("Usuario A");
    expect(result[0].role).toBe("organizer_admin");
  });
});
