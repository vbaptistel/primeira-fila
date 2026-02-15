import { BadRequestException, ConflictException, Injectable } from "@nestjs/common";
import { CommercialPolicy, Prisma } from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CreateCommercialPolicyVersionDto } from "./dto/create-commercial-policy-version.dto";

const DEFAULT_POLICY_VERSION = "platform_default_v1";
const DEFAULT_CURRENCY_CODE = "BRL";
const DEFAULT_TIMEZONE = "America/Sao_Paulo";
const DEFAULT_SERVICE_FEE_PERCENT_BPS = 1000;
const DEFAULT_SERVICE_FEE_FIXED_CENTS = 200;

type PrismaClientLike = PrismaService | Prisma.TransactionClient;

@Injectable()
export class CommercialPoliciesService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultPolicy(
    tenantId: string,
    tx?: Prisma.TransactionClient
  ): Promise<CommercialPolicy> {
    const client = this.getClient(tx);
    const now = new Date();

    const existingDefault = await client.commercialPolicy.findUnique({
      where: {
        tenantId_version: {
          tenantId,
          version: DEFAULT_POLICY_VERSION
        }
      }
    });
    if (existingDefault) {
      return existingDefault;
    }

    try {
      return await client.commercialPolicy.create({
        data: {
          tenantId,
          version: DEFAULT_POLICY_VERSION,
          isPlatformDefault: true,
          serviceFeePercentBps: DEFAULT_SERVICE_FEE_PERCENT_BPS,
          serviceFeeFixedCents: DEFAULT_SERVICE_FEE_FIXED_CENTS,
          currencyCode: DEFAULT_CURRENCY_CODE,
          timezone: DEFAULT_TIMEZONE,
          effectiveFrom: now
        }
      });
    } catch (error) {
      if (!this.isPrismaErrorCode(error, "P2002")) {
        throw error;
      }

      const defaultPolicy = await client.commercialPolicy.findUnique({
        where: {
          tenantId_version: {
            tenantId,
            version: DEFAULT_POLICY_VERSION
          }
        }
      });

      if (!defaultPolicy) {
        throw new ConflictException("Falha ao garantir politica default do tenant.");
      }

      return defaultPolicy;
    }
  }

  async getActivePolicy(tenantId: string, tx?: Prisma.TransactionClient): Promise<CommercialPolicy> {
    const client = this.getClient(tx);
    const now = new Date();

    const activeCustomPolicy = await client.commercialPolicy.findFirst({
      where: {
        tenantId,
        isPlatformDefault: false,
        effectiveFrom: {
          lte: now
        }
      },
      orderBy: [{ effectiveFrom: "desc" }, { createdAt: "desc" }]
    });

    if (activeCustomPolicy) {
      return activeCustomPolicy;
    }

    const defaultPolicy = await this.ensureDefaultPolicy(tenantId, tx);
    return defaultPolicy;
  }

  async getTenantCommercialPolicy(tenantId: string) {
    const policy = await this.getActivePolicy(tenantId);
    return this.toOutput(policy);
  }

  async createPolicyVersion(tenantId: string, dto: CreateCommercialPolicyVersionDto) {
    const version = dto.version.trim().toLowerCase();
    if (version === DEFAULT_POLICY_VERSION) {
      throw new BadRequestException("Versao reservada para politica default da plataforma.");
    }

    const effectiveFrom = this.toDateTime(dto.effectiveFrom);
    const serviceFeePercentBps = Math.round(dto.serviceFeePercent * 100);

    await this.ensureDefaultPolicy(tenantId);

    try {
      const created = await this.prisma.commercialPolicy.create({
        data: {
          tenantId,
          version,
          isPlatformDefault: false,
          serviceFeePercentBps,
          serviceFeeFixedCents: dto.serviceFeeFixedCents,
          currencyCode: dto.currencyCode ?? DEFAULT_CURRENCY_CODE,
          timezone: dto.timezone ?? DEFAULT_TIMEZONE,
          effectiveFrom
        }
      });

      return this.toOutput(created);
    } catch (error) {
      if (this.isPrismaErrorCode(error, "P2002")) {
        throw new ConflictException("Ja existe politica com esta versao para o tenant informado.");
      }

      throw error;
    }
  }

  private toDateTime(value: string | undefined): Date {
    if (!value) {
      return new Date();
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new BadRequestException("effectiveFrom invalido.");
    }

    return parsed;
  }

  private toOutput(policy: CommercialPolicy) {
    return {
      id: policy.id,
      tenantId: policy.tenantId,
      version: policy.version,
      isPlatformDefault: policy.isPlatformDefault,
      serviceFeePercent: policy.serviceFeePercentBps / 100,
      serviceFeeFixedCents: policy.serviceFeeFixedCents,
      currencyCode: policy.currencyCode,
      timezone: policy.timezone,
      effectiveFrom: policy.effectiveFrom,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt
    };
  }

  private getClient(tx?: Prisma.TransactionClient): PrismaClientLike {
    return tx ?? this.prisma;
  }

  private isPrismaErrorCode(error: unknown, code: string): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    return "code" in error && (error as { code?: string }).code === code;
  }
}
