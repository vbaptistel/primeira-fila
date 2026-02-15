import { describe, it, expect, beforeEach, vi } from "vitest";
import { EmailService } from "./email.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { EmailStatus } from "../../generated/prisma/client";

vi.mock("@react-email/render", () => ({
  render: vi.fn().mockResolvedValue("<html>mocked</html>")
}));

function buildMockResend() {
  return {
    emails: {
      send: vi.fn().mockResolvedValue({ data: { id: "resend-msg-001" }, error: null })
    }
  };
}

function buildMockPrisma() {
  return {
    emailLog: {
      create: vi.fn().mockResolvedValue({
        id: "emaillog-001",
        status: EmailStatus.PENDING
      }),
      update: vi.fn().mockResolvedValue({}),
      findUnique: vi.fn(),
      findMany: vi.fn().mockResolvedValue([])
    },
    order: {
      findUnique: vi.fn()
    }
  } as unknown as PrismaService;
}

function buildOrderEmailData() {
  return {
    tenantId: "tenant-001",
    orderId: "order-001",
    buyerName: "Maria Silva",
    buyerEmail: "maria@email.com",
    sessionName: "Sessao Tarde",
    ticketSubtotalCents: 5000,
    serviceFeeCents: 700,
    totalAmountCents: 5700,
    currencyCode: "BRL",
    tickets: [
      {
        qrCode: "qr-001",
        sessionName: "Sessao Tarde",
        seatSector: "A",
        seatRow: "1",
        seatNumber: 10
      }
    ]
  };
}

describe("EmailService", () => {
  let service: EmailService;
  let prisma: PrismaService;
  let resend: ReturnType<typeof buildMockResend>;

  beforeEach(() => {
    prisma = buildMockPrisma();
    resend = buildMockResend();
    service = new EmailService(prisma, resend as never);
  });

  describe("sendOrderConfirmation", () => {
    it("deve criar EmailLog, enviar via Resend e atualizar status para SENT", async () => {
      await service.sendOrderConfirmation(buildOrderEmailData());

      expect(prisma.emailLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId: "tenant-001",
          orderId: "order-001",
          to: "maria@email.com",
          templateName: "order-confirmation",
          status: EmailStatus.PENDING
        })
      });

      expect(resend.emails.send).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "maria@email.com",
          html: "<html>mocked</html>"
        })
      );

      expect(prisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: "emaillog-001" },
        data: expect.objectContaining({
          status: EmailStatus.SENT,
          resendMessageId: "resend-msg-001"
        })
      });
    });

    it("deve atualizar EmailLog para FAILED quando Resend lanca excecao", async () => {
      resend.emails.send.mockRejectedValue(new Error("Resend API error"));

      await service.sendOrderConfirmation(buildOrderEmailData());

      expect(prisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: "emaillog-001" },
        data: expect.objectContaining({
          status: EmailStatus.FAILED,
          errorMessage: "Resend API error"
        })
      });
    });

    it("deve tratar resultado com erro da API Resend como falha", async () => {
      resend.emails.send.mockResolvedValue({
        data: null,
        error: { message: "Rate limit exceeded" }
      });

      await service.sendOrderConfirmation(buildOrderEmailData());

      expect(prisma.emailLog.update).toHaveBeenCalledWith({
        where: { id: "emaillog-001" },
        data: expect.objectContaining({
          status: EmailStatus.FAILED,
          errorMessage: "Rate limit exceeded"
        })
      });
    });
  });

  describe("resendEmail", () => {
    it("deve retornar erro quando emailLog nao encontrado", async () => {
      vi.mocked(prisma.emailLog.findUnique).mockResolvedValue(null);

      const result = await service.resendEmail("emaillog-inexistente");

      expect(result).toEqual({
        success: false,
        error: "Registro de e-mail nao encontrado."
      });
    });

    it("deve retornar erro quando email ja enviado (SENT)", async () => {
      vi.mocked(prisma.emailLog.findUnique).mockResolvedValue({
        id: "emaillog-001",
        status: EmailStatus.SENT,
        orderId: "order-001"
      } as never);

      const result = await service.resendEmail("emaillog-001");

      expect(result).toEqual({
        success: false,
        error: "E-mail ja foi enviado com sucesso."
      });
    });

    it("deve retornar erro quando order nao encontrado", async () => {
      vi.mocked(prisma.emailLog.findUnique).mockResolvedValue({
        id: "emaillog-001",
        status: EmailStatus.FAILED,
        orderId: "order-001"
      } as never);
      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue(null);

      const result = await service.resendEmail("emaillog-001");

      expect(result).toEqual({
        success: false,
        error: "Pedido associado nao encontrado."
      });
    });

    it("deve reenviar email com sucesso", async () => {
      vi.mocked(prisma.emailLog.findUnique).mockResolvedValue({
        id: "emaillog-001",
        status: EmailStatus.FAILED,
        orderId: "order-001"
      } as never);
      (prisma.order as unknown as { findUnique: ReturnType<typeof vi.fn> }).findUnique
        .mockResolvedValue({
          id: "order-001",
          tenantId: "tenant-001",
          buyerName: "Maria Silva",
          buyerEmail: "maria@email.com",
          ticketSubtotalCents: 5000,
          serviceFeeCents: 700,
          totalAmountCents: 5700,
          currencyCode: "BRL",
          session: { name: "Sessao Tarde" },
          tickets: [
            {
              qrCode: "qr-001",
              seat: { sectorCode: "A", rowLabel: "1", seatNumber: 10 },
              session: { name: "Sessao Tarde" }
            }
          ]
        });

      const result = await service.resendEmail("emaillog-001");

      expect(result).toEqual({ success: true });
      expect(resend.emails.send).toHaveBeenCalled();
    });
  });

  describe("getFailedEmails", () => {
    it("deve retornar emails com status FAILED do tenant", async () => {
      const failedEmails = [
        { id: "emaillog-001", status: EmailStatus.FAILED, tenantId: "tenant-001" }
      ];
      vi.mocked(prisma.emailLog.findMany).mockResolvedValue(failedEmails as never);

      const result = await service.getFailedEmails("tenant-001");

      expect(result).toEqual(failedEmails);
      expect(prisma.emailLog.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: "tenant-001",
          status: EmailStatus.FAILED
        },
        orderBy: { createdAt: "desc" },
        take: 50
      });
    });
  });
});
