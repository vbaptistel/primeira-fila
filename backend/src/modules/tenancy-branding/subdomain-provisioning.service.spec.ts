import { beforeEach, describe, expect, it, vi } from "vitest";
import { Tenant } from "../../generated/prisma/client";
import { SubdomainProvisioningService } from "./subdomain-provisioning.service";
import { VercelApiClient } from "./vercel-api.client";

const TENANT_FIXTURE = {
  id: "00000000-0000-0000-0000-000000000001",
  subdomain: "acme"
} as Tenant;

function createMockVercelClient() {
  return {
    isConfigured: vi.fn(),
    addDomainToProject: vi.fn(),
    getDomainConfig: vi.fn(),
    createDnsRecord: vi.fn()
  } as unknown as VercelApiClient;
}

describe("SubdomainProvisioningService", () => {
  let service: SubdomainProvisioningService;
  let vercel: ReturnType<typeof createMockVercelClient>;

  beforeEach(() => {
    delete process.env.PLATFORM_SUBDOMAIN_BASE_DOMAIN;
    delete process.env.PLATFORM_BASE_DOMAINS;
    vercel = createMockVercelClient();
    service = new SubdomainProvisioningService(vercel as unknown as VercelApiClient);
  });

  it("nao deve chamar Vercel quando Vercel nao esta configurada", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(false);

    await service.provisionSubdomain(TENANT_FIXTURE);

    expect(vercel.addDomainToProject).not.toHaveBeenCalled();
    expect(vercel.getDomainConfig).not.toHaveBeenCalled();
    expect(vercel.createDnsRecord).not.toHaveBeenCalled();
  });

  it("nao deve fazer nada quando tenant nao tem subdomain", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);

    await service.provisionSubdomain({
      ...TENANT_FIXTURE,
      subdomain: ""
    });

    expect(vercel.addDomainToProject).not.toHaveBeenCalled();
  });

  it("deve adicionar dominio ao projeto, obter CNAME e criar registro DNS quando Vercel configurada", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockResolvedValue(undefined);
    vi.mocked(vercel.getDomainConfig).mockResolvedValue({
      verified: false,
      recommendedCnameValue: "cname.vercel-dns.com",
      dnsInstructions: []
    });
    vi.mocked(vercel.createDnsRecord).mockResolvedValue(undefined);

    await service.provisionSubdomain(TENANT_FIXTURE);

    expect(vercel.addDomainToProject).toHaveBeenCalledWith("acme.primeirafila.app");
    expect(vercel.getDomainConfig).toHaveBeenCalledWith("acme.primeirafila.app");
    expect(vercel.createDnsRecord).toHaveBeenCalledWith("primeirafila.app", {
      type: "CNAME",
      name: "acme",
      value: "cname.vercel-dns.com"
    });
  });

  it("deve usar PLATFORM_SUBDOMAIN_BASE_DOMAIN quando definido", async () => {
    process.env.PLATFORM_SUBDOMAIN_BASE_DOMAIN = "primeirafila.app";
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockResolvedValue(undefined);
    vi.mocked(vercel.getDomainConfig).mockResolvedValue({
      verified: false,
      recommendedCnameValue: "cname.vercel-dns.com",
      dnsInstructions: []
    });
    vi.mocked(vercel.createDnsRecord).mockResolvedValue(undefined);

    await service.provisionSubdomain(TENANT_FIXTURE);

    expect(vercel.addDomainToProject).toHaveBeenCalledWith("acme.primeirafila.app");
    expect(vercel.createDnsRecord).toHaveBeenCalledWith("primeirafila.app", {
      type: "CNAME",
      name: "acme",
      value: "cname.vercel-dns.com"
    });
  });

  it("nao deve lancar quando addDomainToProject falha", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockRejectedValue(new Error("Vercel 500"));

    await expect(service.provisionSubdomain(TENANT_FIXTURE)).resolves.toBeUndefined();
    expect(vercel.getDomainConfig).not.toHaveBeenCalled();
    expect(vercel.createDnsRecord).not.toHaveBeenCalled();
  });

  it("nao deve lancar quando getDomainConfig falha", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockResolvedValue(undefined);
    vi.mocked(vercel.getDomainConfig).mockRejectedValue(new Error("Config unavailable"));

    await expect(service.provisionSubdomain(TENANT_FIXTURE)).resolves.toBeUndefined();
    expect(vercel.createDnsRecord).not.toHaveBeenCalled();
  });

  it("nao deve lancar quando createDnsRecord falha (ex.: dominio nao no Vercel DNS)", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockResolvedValue(undefined);
    vi.mocked(vercel.getDomainConfig).mockResolvedValue({
      verified: false,
      recommendedCnameValue: "cname.vercel-dns.com",
      dnsInstructions: []
    });
    vi.mocked(vercel.createDnsRecord).mockRejectedValue(new Error("Domain not in Vercel DNS"));

    await expect(service.provisionSubdomain(TENANT_FIXTURE)).resolves.toBeUndefined();
  });

  it("nao deve criar registro DNS quando recommendedCnameValue e null", async () => {
    vi.mocked(vercel.isConfigured).mockReturnValue(true);
    vi.mocked(vercel.addDomainToProject).mockResolvedValue(undefined);
    vi.mocked(vercel.getDomainConfig).mockResolvedValue({
      verified: false,
      recommendedCnameValue: null,
      dnsInstructions: []
    });

    await service.provisionSubdomain(TENANT_FIXTURE);

    expect(vercel.addDomainToProject).toHaveBeenCalled();
    expect(vercel.createDnsRecord).not.toHaveBeenCalled();
  });
});
