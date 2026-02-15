import { Injectable } from "@nestjs/common";
import { createHmac, timingSafeEqual } from "node:crypto";

@Injectable()
export class MagicLinkTokenService {
  private readonly secret: string;

  constructor() {
    const secret = process.env["MAGIC_LINK_SECRET"];
    if (!secret) {
      throw new Error("MAGIC_LINK_SECRET environment variable is required.");
    }
    this.secret = secret;
  }

  generateToken(orderId: string, buyerEmail: string): string {
    const payload = `${orderId}:${buyerEmail.toLowerCase().trim()}`;
    return createHmac("sha256", this.secret).update(payload).digest("hex");
  }

  validateToken(orderId: string, buyerEmail: string, token: string): boolean {
    const expectedToken = this.generateToken(orderId, buyerEmail);

    const tokenBuffer = Buffer.from(token, "hex");
    const expectedBuffer = Buffer.from(expectedToken, "hex");

    if (tokenBuffer.length !== expectedBuffer.length) {
      return false;
    }

    return timingSafeEqual(tokenBuffer, expectedBuffer);
  }

  buildOrderAccessUrl(baseUrl: string, orderId: string, buyerEmail: string): string {
    const token = this.generateToken(orderId, buyerEmail);
    return `${baseUrl}/pedidos/${orderId}?token=${token}&email=${encodeURIComponent(buyerEmail)}`;
  }
}
