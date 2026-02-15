import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { MagicLinkTokenService } from "./magic-link-token.service";

describe("MagicLinkTokenService", () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV, MAGIC_LINK_SECRET: "test-secret-key-32-chars-long!!" };
  });

  afterEach(() => {
    process.env = ORIGINAL_ENV;
    vi.restoreAllMocks();
  });

  it("deve lancar erro quando MAGIC_LINK_SECRET nao esta definido", () => {
    delete process.env["MAGIC_LINK_SECRET"];

    expect(() => new MagicLinkTokenService()).toThrow(
      "MAGIC_LINK_SECRET environment variable is required."
    );
  });

  it("deve gerar token determinístico para mesmos parametros", () => {
    const service = new MagicLinkTokenService();

    const token1 = service.generateToken("order-123", "user@example.com");
    const token2 = service.generateToken("order-123", "user@example.com");

    expect(token1).toBe(token2);
    expect(token1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("deve gerar tokens diferentes para order IDs diferentes", () => {
    const service = new MagicLinkTokenService();

    const token1 = service.generateToken("order-123", "user@example.com");
    const token2 = service.generateToken("order-456", "user@example.com");

    expect(token1).not.toBe(token2);
  });

  it("deve gerar tokens diferentes para emails diferentes", () => {
    const service = new MagicLinkTokenService();

    const token1 = service.generateToken("order-123", "user1@example.com");
    const token2 = service.generateToken("order-123", "user2@example.com");

    expect(token1).not.toBe(token2);
  });

  it("deve normalizar email para minusculo e sem espacos", () => {
    const service = new MagicLinkTokenService();

    const token1 = service.generateToken("order-123", "User@Example.COM");
    const token2 = service.generateToken("order-123", "  user@example.com  ");
    const token3 = service.generateToken("order-123", "user@example.com");

    expect(token1).toBe(token3);
    expect(token2).toBe(token3);
  });

  it("deve validar token correto", () => {
    const service = new MagicLinkTokenService();

    const token = service.generateToken("order-123", "user@example.com");
    const isValid = service.validateToken("order-123", "user@example.com", token);

    expect(isValid).toBe(true);
  });

  it("deve rejeitar token invalido", () => {
    const service = new MagicLinkTokenService();

    const isValid = service.validateToken("order-123", "user@example.com", "token-invalido");

    expect(isValid).toBe(false);
  });

  it("deve rejeitar token de outro pedido", () => {
    const service = new MagicLinkTokenService();

    const token = service.generateToken("order-123", "user@example.com");
    const isValid = service.validateToken("order-456", "user@example.com", token);

    expect(isValid).toBe(false);
  });

  it("deve rejeitar token de outro email", () => {
    const service = new MagicLinkTokenService();

    const token = service.generateToken("order-123", "user@example.com");
    const isValid = service.validateToken("order-123", "other@example.com", token);

    expect(isValid).toBe(false);
  });

  it("deve normalizar email na validacao", () => {
    const service = new MagicLinkTokenService();

    const token = service.generateToken("order-123", "user@example.com");
    const isValid = service.validateToken("order-123", " User@Example.COM ", token);

    expect(isValid).toBe(true);
  });

  it("deve construir URL de acesso corretamente", () => {
    const service = new MagicLinkTokenService();

    const url = service.buildOrderAccessUrl(
      "https://tenant.primeirafila.com",
      "order-123",
      "user@example.com"
    );

    expect(url).toContain("https://tenant.primeirafila.com/pedidos/order-123");
    expect(url).toContain("token=");
    expect(url).toContain("email=user%40example.com");

    // Extrair token da URL e validar
    const urlObj = new URL(url);
    const token = urlObj.searchParams.get("token")!;
    const email = urlObj.searchParams.get("email")!;

    expect(service.validateToken("order-123", email, token)).toBe(true);
  });

  it("deve rejeitar token com comprimento diferente do esperado", () => {
    const service = new MagicLinkTokenService();

    const isValid = service.validateToken("order-123", "user@example.com", "abc");

    expect(isValid).toBe(false);
  });
});
