import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getPlatformBaseDomains, parseHostForTenant } from "./tenant-resolver.utils";

describe("tenant-resolver.utils", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getPlatformBaseDomains", () => {
    it("deve retornar primeirafila.app e primeirafila.app por padrao", () => {
      delete process.env.PLATFORM_BASE_DOMAINS;
      expect(getPlatformBaseDomains()).toEqual(["primeirafila.app", "primeirafila.app"]);
    });

    it("deve usar PLATFORM_BASE_DOMAINS quando definido", () => {
      process.env.PLATFORM_BASE_DOMAINS = "meusite.com, outro.app";
      expect(getPlatformBaseDomains()).toEqual(["meusite.com", "outro.app"]);
    });

    it("deve normalizar para lowercase e trim", () => {
      process.env.PLATFORM_BASE_DOMAINS = "  PrimeiraFila.App  ";
      expect(getPlatformBaseDomains()).toEqual(["primeirafila.app"]);
    });
  });

  describe("parseHostForTenant", () => {
    it("deve retornar subdomain para acme.primeirafila.app", () => {
      const result = parseHostForTenant("acme.primeirafila.app");
      expect(result).toEqual({ type: "subdomain", subdomain: "acme" });
    });

    it("deve retornar subdomain para acme.primeirafila.app", () => {
      const result = parseHostForTenant("acme.primeirafila.app");
      expect(result).toEqual({ type: "subdomain", subdomain: "acme" });
    });

    it("deve remover porta e retornar subdomain", () => {
      const result = parseHostForTenant("acme.primeirafila.app:443");
      expect(result).toEqual({ type: "subdomain", subdomain: "acme" });
    });

    it("deve retornar null para dominio base puro primeirafila.app", () => {
      expect(parseHostForTenant("primeirafila.app")).toBeNull();
    });

    it("deve retornar null para dominio base puro primeirafila.app", () => {
      expect(parseHostForTenant("primeirafila.app")).toBeNull();
    });

    it("deve retornar null para www.primeirafila.app", () => {
      expect(parseHostForTenant("www.primeirafila.app")).toBeNull();
    });

    it("deve retornar null para www.primeirafila.app", () => {
      expect(parseHostForTenant("www.primeirafila.app")).toBeNull();
    });

    it("deve retornar null para subdominio multi-nivel a.b.primeirafila.app", () => {
      expect(parseHostForTenant("a.b.primeirafila.app")).toBeNull();
    });

    it("deve retornar custom para dominio externo", () => {
      const result = parseHostForTenant("ingressos.acme.com.br");
      expect(result).toEqual({ type: "custom", domain: "ingressos.acme.com.br" });
    });

    it("deve retornar null para host vazio apos remover porta", () => {
      expect(parseHostForTenant("")).toBeNull();
    });

    it("deve normalizar host para lowercase", () => {
      const result = parseHostForTenant("ACME.PrimeiraFila.App");
      expect(result).toEqual({ type: "subdomain", subdomain: "acme" });
    });
  });
});
