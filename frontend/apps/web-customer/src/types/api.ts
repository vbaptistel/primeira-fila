export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
export type SessionStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "EXPIRED";
export type TicketStatus = "VALID" | "USED" | "CANCELLED";
export type SessionSeatStatus = "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";

export type PublicEvent = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  eventDays: PublicEventDay[];
};

export type PublicEventDay = {
  id: string;
  date: string;
  status: string;
  sessions: PublicSession[];
};

export type PublicSession = {
  id: string;
  name: string;
  startsAt: string;
  endsAt: string;
  salesStartsAt: string | null;
  salesEndsAt: string | null;
  priceCents: number;
  currencyCode: string;
  capacity: number;
  status: SessionStatus;
};

export type PublicSessionSeat = {
  id: string;
  sectorCode: string;
  rowLabel: string;
  seatNumber: number;
  status: SessionSeatStatus;
};

export type HoldResponse = {
  holdId: string;
  sessionId: string;
  status: string;
  expiresAt: string;
  seats: {
    seatId: string;
    sectorCode: string;
    rowLabel: string;
    seatNumber: number;
  }[];
};

export type OrderResponse = {
  id: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  ticketSubtotalCents: number;
  serviceFeeCents: number;
  totalAmountCents: number;
  currencyCode: string;
  createdAt: string;
  session: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  };
  items: {
    id: string;
    unitPriceCents: number;
    currencyCode: string;
  }[];
  tickets: TicketResponse[];
};

export type CreateOrderRequest = {
  holdId: string;
  buyer: {
    name: string;
    email: string;
    document?: string;
  };
};

export type CreateOrderResponse = {
  id: string;
  status: OrderStatus;
  holdId: string;
  holdExpiresAt: string;
  totalAmountCents: number;
  currencyCode: string;
};

export type CreatePaymentRequest = {
  method: "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
  gateway?: string;
  cardToken?: string;
};

export type PaymentResponse = {
  id: string;
  status: string;
  providerPaymentId: string;
  order: {
    id: string;
    status: OrderStatus;
  };
};

export type TicketResponse = {
  id: string;
  qrCode: string;
  status: TicketStatus;
  seat: {
    id: string;
    sectorCode: string;
    rowLabel: string;
    seatNumber: number;
  };
  session: {
    id: string;
    name: string;
    startsAt: string;
    endsAt: string;
  };
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  traceId?: string;
};
