/**
 * Domínios base da plataforma para resolução de tenant por subdomínio.
 * Subdomínios válidos: acme.primeirafila.app, acme.primeirafila.app
 */
const DEFAULT_BASE_DOMAINS = ["primeirafila.app", "primeirafila.app"];

export function getPlatformBaseDomains(): string[] {
  const env = process.env.PLATFORM_BASE_DOMAINS;
  if (env) {
    return env
      .split(",")
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
  }
  return [...DEFAULT_BASE_DOMAINS];
}

export type HostParseResult =
  | { type: "subdomain"; subdomain: string; }
  | { type: "custom"; domain: string; }
  | null;

/**
 * Normaliza o host (remove porta, lowercase) e classifica para resolução de tenant:
 * - subdomain: um único subdomínio de um domínio base (ex: acme.primeirafila.app → acme)
 * - custom: host que não é subdomínio da plataforma (domínio customizado)
 * - null: domínio base puro, www ou subdomínio multi-nível (não resolve tenant)
 */
export function parseHostForTenant(hostRaw: string): HostParseResult {
  const host = hostRaw.split(":")[0].toLowerCase().trim();
  if (!host) return null;

  const baseDomains = getPlatformBaseDomains();

  for (const base of baseDomains) {
    const suffix = `.${base}`;
    if (host !== base && host.endsWith(suffix)) {
      const subdomain = host.slice(0, -suffix.length);
      if (subdomain && !subdomain.includes(".") && subdomain !== "www") {
        return { type: "subdomain", subdomain };
      }
      return null;
    }
    if (host === base) return null;
  }

  return { type: "custom", domain: host };
}
