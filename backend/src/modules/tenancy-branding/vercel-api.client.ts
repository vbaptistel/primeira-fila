/**
 * Cliente HTTP compartilhado para a API da Vercel (domínios e DNS).
 * Usado por CustomDomainService e SubdomainProvisioningService.
 */
export type DnsInstruction = {
  type: string;
  name: string;
  value: string;
  purpose: string;
};

type VercelDomainConfigResponse = {
  configuredBy: "CNAME" | "A" | "http" | "dns-01" | null;
  recommendedIPv4?: Array<{ rank: number; value: string[] }>;
  recommendedCNAME?: Array<{ rank: number; value: string }>;
  misconfigured: boolean;
};

export type GetDomainConfigResult = {
  verified: boolean;
  recommendedCnameValue: string | null;
  dnsInstructions: DnsInstruction[];
};

export class VercelApiClient {
  private readonly base = "https://api.vercel.com";
  readonly token: string | undefined;
  readonly teamId: string | undefined;
  readonly projectId: string | undefined;

  constructor(options?: {
    token?: string;
    teamId?: string;
    projectId?: string;
  }) {
    this.token = options?.token ?? process.env.VERCEL_TOKEN;
    this.teamId = options?.teamId ?? process.env.VERCEL_TEAM_ID;
    this.projectId = options?.projectId ?? process.env.VERCEL_WEB_CUSTOMER_PROJECT_ID;
  }

  isConfigured(): boolean {
    return Boolean(this.token && this.projectId);
  }

  buildUrl(path: string, extraParams?: Record<string, string>): string {
    const params = new URLSearchParams();
    if (this.teamId) params.set("teamId", this.teamId);
    if (extraParams) {
      for (const [k, v] of Object.entries(extraParams)) {
        if (v) params.set(k, v);
      }
    }
    const query = params.toString() ? `?${params.toString()}` : "";
    return `${this.base}${path}${query}`;
  }

  buildHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.token}`,
      "Content-Type": "application/json"
    };
  }

  async addDomainToProject(domain: string): Promise<void> {
    const url = this.buildUrl(`/v10/projects/${this.projectId}/domains`);
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify({ name: domain })
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vercel addDomain falhou (${response.status}): ${body}`);
    }
  }

  async removeDomainFromProject(domain: string): Promise<void> {
    const url = this.buildUrl(
      `/v9/projects/${this.projectId}/domains/${encodeURIComponent(domain)}`
    );
    const response = await fetch(url, {
      method: "DELETE",
      headers: this.buildHeaders()
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vercel removeDomain falhou (${response.status}): ${body}`);
    }
  }

  async getDomainConfig(domain: string): Promise<GetDomainConfigResult> {
    const path = `/v6/domains/${encodeURIComponent(domain)}/config`;
    const url = this.buildUrl(
      path,
      this.projectId ? { projectIdOrName: this.projectId } : undefined
    );
    const response = await fetch(url, {
      method: "GET",
      headers: this.buildHeaders()
    });
    if (!response.ok) {
      throw new Error(`Vercel getDomainConfig falhou (${response.status}): ${await response.text()}`);
    }
    const data = (await response.json()) as VercelDomainConfigResponse;
    const verified = data.misconfigured === false;
    const cnameRank1 = data.recommendedCNAME?.find((r) => r.rank === 1);
    const recommendedCnameValue = cnameRank1?.value ?? null;
    const dnsInstructions = this.buildDnsInstructions(domain, data);
    return { verified, recommendedCnameValue, dnsInstructions };
  }

  async createDnsRecord(
    zoneDomain: string,
    record: { type: string; name: string; value: string }
  ): Promise<void> {
    const url = this.buildUrl(`/v2/domains/${encodeURIComponent(zoneDomain)}/records`);
    const response = await fetch(url, {
      method: "POST",
      headers: this.buildHeaders(),
      body: JSON.stringify(record)
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`Vercel createDnsRecord falhou (${response.status}): ${body}`);
    }
  }

  private buildDnsInstructions(
    domain: string,
    config: VercelDomainConfigResponse
  ): DnsInstruction[] {
    const instructions: DnsInstruction[] = [];
    const cnameRank1 = config.recommendedCNAME?.find((r) => r.rank === 1);
    if (cnameRank1?.value) {
      instructions.push({
        type: "CNAME",
        name: domain,
        value: cnameRank1.value,
        purpose: "Apontar o dominio para a Vercel. Configure este registro no seu provedor de DNS."
      });
    }
    const ipv4Rank1 = config.recommendedIPv4?.find((r) => r.rank === 1);
    if (ipv4Rank1?.value?.length) {
      const value = Array.isArray(ipv4Rank1.value)
        ? ipv4Rank1.value[0]
        : String(ipv4Rank1.value);
      instructions.push({
        type: "A",
        name: domain,
        value,
        purpose: "Apontar o dominio para a Vercel. Configure este registro no seu provedor de DNS."
      });
    }
    if (instructions.length === 0) {
      throw new Error(
        `Vercel nao retornou instrucoes DNS (CNAME ou A) para o dominio ${domain}.`
      );
    }
    return instructions;
  }
}
