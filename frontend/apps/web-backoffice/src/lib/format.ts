import type { EventStatus, OrderStatus, PaymentStatus, SessionSeatStatus, SessionStatus } from "@/types/api";

export function formatCurrency(cents: number, currencyCode = "BRL"): string {
  const value = cents / 100;
  if (currencyCode === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
  return `${currencyCode} ${value.toFixed(2)}`;
}

export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

export function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function formatDateTime(isoDate: string): string {
  return `${formatDate(isoDate)} as ${formatTime(isoDate)}`;
}

export const eventStatusLabels: Record<EventStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  CANCELLED: "Cancelado",
  ARCHIVED: "Arquivado"
};

export const sessionStatusLabels: Record<SessionStatus, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  CANCELLED: "Cancelada"
};

export const orderStatusLabels: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Aguardando Pagamento",
  PAID: "Pago",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado"
};

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  PENDING: "Pendente",
  APPROVED: "Aprovado",
  DENIED: "Negado",
  REFUNDED: "Reembolsado",
  ERROR: "Erro"
};

export const seatStatusLabels: Record<SessionSeatStatus, string> = {
  AVAILABLE: "Disponivel",
  HELD: "Reservado",
  SOLD: "Vendido",
  BLOCKED: "Bloqueado"
};
