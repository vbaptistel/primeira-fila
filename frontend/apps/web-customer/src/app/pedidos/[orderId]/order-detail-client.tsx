"use client";

import Image from "next/image";
import { Badge, Separator } from "@primeira-fila/shared";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderResponse } from "@/types/api";

type OrderDetailClientProps = {
  order: OrderResponse;
};

function getStatusBadge(status: string) {
  switch (status) {
    case "PAID":
      return <Badge variant="primary">Pago</Badge>;
    case "PENDING_PAYMENT":
      return <Badge variant="accent">Aguardando pagamento</Badge>;
    case "CANCELLED":
      return <Badge variant="danger">Cancelado</Badge>;
    case "EXPIRED":
      return <Badge variant="outline">Expirado</Badge>;
    default:
      return <Badge variant="default">{status}</Badge>;
  }
}

export function OrderDetailClient({ order }: OrderDetailClientProps) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-2xl font-bold text-[var(--pf-color-text)]">Meu pedido</h1>
          {getStatusBadge(order.status)}
        </div>
        <p className="text-sm text-[var(--pf-color-muted-text)]">
          Pedido {order.id.slice(0, 8)} - {formatDateTime(order.createdAt)}
        </p>
      </div>

      {/* Resumo */}
      <div className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-6 mb-6">
        <h2 className="text-lg font-semibold text-[var(--pf-color-text)] mb-4">Resumo</h2>

        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-[var(--pf-color-muted-text)]">Comprador</span>
            <span className="text-[var(--pf-color-text)] font-medium">{order.buyerName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--pf-color-muted-text)]">Sessao</span>
            <span className="text-[var(--pf-color-text)] font-medium">{order.session.name}</span>
          </div>
          <Separator className="my-3" />
          <div className="flex justify-between">
            <span className="text-[var(--pf-color-muted-text)]">Subtotal ingressos</span>
            <span>{formatCurrency(order.ticketSubtotalCents, order.currencyCode)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[var(--pf-color-muted-text)]">Taxa de servico</span>
            <span>{formatCurrency(order.serviceFeeCents, order.currencyCode)}</span>
          </div>
          <Separator className="my-3" />
          <div className="flex justify-between text-base font-bold">
            <span className="text-[var(--pf-color-text)]">Total</span>
            <span style={{ color: "var(--pf-color-primary)" }}>
              {formatCurrency(order.totalAmountCents, order.currencyCode)}
            </span>
          </div>
        </div>
      </div>

      {/* Ingressos */}
      {order.tickets.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-[var(--pf-color-text)] mb-4">
            Seus ingressos ({order.tickets.length})
          </h2>

          <div className="space-y-4">
            {order.tickets.map((ticket) => (
              <div
                key={ticket.id}
                className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-[var(--pf-color-text)]">
                      {ticket.session.name}
                    </h3>
                    <p className="text-sm text-[var(--pf-color-muted-text)] mt-1">
                      Setor {ticket.seat.sectorCode} | Fileira {ticket.seat.rowLabel} | Assento {ticket.seat.seatNumber}
                    </p>
                    <div className="mt-2">
                      <Badge variant={ticket.status === "VALID" ? "primary" : "danger"}>
                        {ticket.status === "VALID" ? "Valido" : ticket.status === "USED" ? "Utilizado" : "Cancelado"}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    <Image
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(ticket.qrCode)}`}
                      alt={`QR Code - ${ticket.seat.sectorCode} ${ticket.seat.rowLabel}${ticket.seat.seatNumber}`}
                      width={100}
                      height={100}
                      className="rounded-[var(--pf-radius-sm)] border border-[var(--pf-color-border)]"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
