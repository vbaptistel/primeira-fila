import {
  ConflictException,
  GoneException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { AuditAction, TicketStatus } from "../../generated/prisma/client";
import { AuditService } from "../../common/audit/audit.service";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

@Injectable()
export class CheckInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService
  ) {}

  async validateCheckIn(qrCode: string, actorId?: string) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { qrCode },
      include: {
        seat: {
          select: {
            id: true,
            sectorCode: true,
            rowLabel: true,
            seatNumber: true
          }
        },
        session: {
          select: {
            id: true,
            name: true,
            startsAt: true,
            endsAt: true
          }
        },
        order: {
          select: {
            id: true,
            buyerName: true,
            buyerEmail: true
          }
        }
      }
    });

    if (!ticket) {
      throw new NotFoundException("Ticket nao encontrado para o QR informado.");
    }

    if (ticket.status === TicketStatus.USED) {
      throw new ConflictException("Ticket ja utilizado. Check-in negado.");
    }

    if (ticket.status === TicketStatus.CANCELLED) {
      throw new GoneException("Ticket cancelado. Check-in negado.");
    }

    const updated = await this.prisma.ticket.updateMany({
      where: {
        id: ticket.id,
        status: TicketStatus.VALID
      },
      data: {
        status: TicketStatus.USED,
        usedAt: new Date()
      }
    });

    if (updated.count === 0) {
      throw new ConflictException("Ticket ja utilizado ou cancelado. Check-in negado.");
    }

    if (actorId) {
      await this.auditService.log({
        tenantId: ticket.tenantId,
        actorId,
        action: AuditAction.CHECK_IN,
        resourceType: "ticket",
        resourceId: ticket.id,
        metadata: {
          qrCode: ticket.qrCode,
          orderId: ticket.orderId,
          sessionId: ticket.sessionId,
          seatId: ticket.seatId
        }
      });
    }

    return {
      ticketId: ticket.id,
      status: TicketStatus.USED,
      usedAt: new Date(),
      seat: ticket.seat,
      session: ticket.session,
      order: ticket.order
    };
  }
}
