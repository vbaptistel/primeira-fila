import { Inject, Injectable, Logger } from "@nestjs/common";
import { Resend } from "resend";
import { render } from "@react-email/render";
import { EmailStatus } from "../../generated/prisma/client";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { RESEND_CLIENT } from "./resend.provider";
import { OrderConfirmationEmail, TenantBranding } from "./templates/order-confirmation";

type OrderEmailData = {
  tenantId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  sessionName: string;
  ticketSubtotalCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currencyCode: string;
  orderAccessUrl?: string;
  tickets: {
    qrCode: string;
    sessionName: string;
    seatSector: string;
    seatRow: string;
    seatNumber: number;
  }[];
};

type OrderAccessLinkData = {
  tenantId: string;
  orderId: string;
  buyerName: string;
  buyerEmail: string;
  sessionName: string;
  orderAccessUrl: string;
};

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly emailFrom: string;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(RESEND_CLIENT) private readonly resend: Resend
  ) {
    this.emailFrom = process.env["EMAIL_FROM"] ?? "Primeira Fila <noreply@primeirafila.com>";
  }

  async sendOrderConfirmation(data: OrderEmailData): Promise<void> {
    const subject = `Confirmacao de compra - Pedido ${data.orderId.slice(0, 8)}`;

    const emailLog = await this.prisma.emailLog.create({
      data: {
        tenantId: data.tenantId,
        orderId: data.orderId,
        to: data.buyerEmail,
        subject,
        templateName: "order-confirmation",
        status: EmailStatus.PENDING
      }
    });

    try {
      const branding = await this.loadTenantBranding(data.tenantId);

      const html = await render(
        OrderConfirmationEmail({
          buyerName: data.buyerName,
          orderId: data.orderId,
          sessionName: data.sessionName,
          ticketSubtotalCents: data.ticketSubtotalCents,
          serviceFeeCents: data.serviceFeeCents,
          totalAmountCents: data.totalAmountCents,
          currencyCode: data.currencyCode,
          orderAccessUrl: data.orderAccessUrl,
          tickets: data.tickets,
          branding
        })
      );

      const result = await this.resend.emails.send({
        from: this.emailFrom,
        to: data.buyerEmail,
        subject,
        html
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await this.prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailStatus.SENT,
          resendMessageId: result.data?.id,
          sentAt: new Date()
        }
      });

      this.logger.log(
        `E-mail de confirmacao enviado para ${data.buyerEmail} (orderId=${data.orderId}, resendId=${result.data?.id})`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido ao enviar e-mail";

      await this.prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: errorMessage.slice(0, 500)
        }
      });

      this.logger.error(
        `Falha ao enviar e-mail de confirmacao para ${data.buyerEmail} (orderId=${data.orderId}): ${errorMessage}`
      );
    }
  }

  async sendOrderAccessLink(data: OrderAccessLinkData): Promise<void> {
    const subject = `Acesso ao seu pedido - ${data.sessionName}`;

    const emailLog = await this.prisma.emailLog.create({
      data: {
        tenantId: data.tenantId,
        orderId: data.orderId,
        to: data.buyerEmail,
        subject,
        templateName: "order-access-link",
        status: EmailStatus.PENDING
      }
    });

    try {
      const branding = await this.loadTenantBranding(data.tenantId);

      const html = await render(
        OrderConfirmationEmail({
          buyerName: data.buyerName,
          orderId: data.orderId,
          sessionName: data.sessionName,
          ticketSubtotalCents: 0,
          serviceFeeCents: 0,
          totalAmountCents: 0,
          currencyCode: "BRL",
          orderAccessUrl: data.orderAccessUrl,
          tickets: [],
          branding,
          isAccessLink: true
        })
      );

      const result = await this.resend.emails.send({
        from: this.emailFrom,
        to: data.buyerEmail,
        subject,
        html
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      await this.prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailStatus.SENT,
          resendMessageId: result.data?.id,
          sentAt: new Date()
        }
      });

      this.logger.log(
        `E-mail de acesso enviado para ${data.buyerEmail} (orderId=${data.orderId}, resendId=${result.data?.id})`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Erro desconhecido ao enviar e-mail";

      await this.prisma.emailLog.update({
        where: { id: emailLog.id },
        data: {
          status: EmailStatus.FAILED,
          errorMessage: errorMessage.slice(0, 500)
        }
      });

      this.logger.error(
        `Falha ao enviar e-mail de acesso para ${data.buyerEmail} (orderId=${data.orderId}): ${errorMessage}`
      );
    }
  }

  async resendEmail(emailLogId: string): Promise<{ success: boolean; error?: string }> {
    const emailLog = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId }
    });

    if (!emailLog) {
      return { success: false, error: "Registro de e-mail nao encontrado." };
    }

    if (emailLog.status === EmailStatus.SENT) {
      return { success: false, error: "E-mail ja foi enviado com sucesso." };
    }

    const order = emailLog.orderId
      ? await this.prisma.order.findUnique({
          where: { id: emailLog.orderId },
          include: {
            session: { select: { name: true } },
            tickets: {
              include: {
                seat: {
                  select: { sectorCode: true, rowLabel: true, seatNumber: true }
                },
                session: { select: { name: true } }
              }
            }
          }
        })
      : null;

    if (!order) {
      return { success: false, error: "Pedido associado nao encontrado." };
    }

    await this.sendOrderConfirmation({
      tenantId: order.tenantId,
      orderId: order.id,
      buyerName: order.buyerName,
      buyerEmail: order.buyerEmail,
      sessionName: order.session.name,
      ticketSubtotalCents: order.ticketSubtotalCents,
      serviceFeeCents: order.serviceFeeCents,
      totalAmountCents: order.totalAmountCents,
      currencyCode: order.currencyCode,
      tickets: order.tickets.map((t) => ({
        qrCode: t.qrCode,
        sessionName: t.session.name,
        seatSector: t.seat.sectorCode,
        seatRow: t.seat.rowLabel,
        seatNumber: t.seat.seatNumber
      }))
    });

    return { success: true };
  }

  async getFailedEmails(tenantId: string) {
    return this.prisma.emailLog.findMany({
      where: {
        tenantId,
        status: EmailStatus.FAILED
      },
      orderBy: { createdAt: "desc" },
      take: 50
    });
  }

  private async loadTenantBranding(tenantId: string): Promise<TenantBranding | undefined> {
    try {
      const tenant = await this.prisma.tenant.findUnique({
        where: { id: tenantId },
        select: {
          name: true,
          logoUrl: true,
          primaryColor: true,
          footerText: true,
          termsUrl: true,
          privacyUrl: true
        }
      });

      if (!tenant) {
        return undefined;
      }

      return {
        tenantName: tenant.name,
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        footerText: tenant.footerText,
        termsUrl: tenant.termsUrl,
        privacyUrl: tenant.privacyUrl
      };
    } catch (error) {
      this.logger.warn(
        `Nao foi possivel carregar branding do tenant ${tenantId}: ${String(error)}`
      );
      return undefined;
    }
  }
}
