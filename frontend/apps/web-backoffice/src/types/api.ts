// ─── Status Enums ─────────────────────────────────────────────
export type EventStatus = "DRAFT" | "PUBLISHED" | "CANCELLED" | "ARCHIVED";
export type SessionStatus = "DRAFT" | "PUBLISHED" | "CANCELLED";
export type SessionSeatStatus = "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED";
export type OrderStatus = "PENDING_PAYMENT" | "PAID" | "CANCELLED" | "EXPIRED";
export type PaymentStatus = "PENDING" | "APPROVED" | "DENIED" | "REFUNDED" | "ERROR";
export type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD";
export type TicketStatus = "VALID" | "USED" | "CANCELLED";

// ─── Events ───────────────────────────────────────────────────
export type AdminEvent = {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  description: string | null;
  timezone: string;
  status: EventStatus;
  createdAt: string;
  updatedAt: string;
  eventDays: AdminEventDay[];
};

export type AdminEventDay = {
  id: string;
  eventId: string;
  date: string;
  label: string | null;
  status: string;
  createdAt: string;
  sessions: AdminSession[];
};

export type AdminSession = {
  id: string;
  eventDayId: string;
  name: string;
  startsAt: string;
  endsAt: string;
  salesStartsAt: string | null;
  salesEndsAt: string | null;
  priceCents: number;
  currencyCode: string;
  capacity: number;
  status: SessionStatus;
  createdAt: string;
};

export type AdminSessionSeat = {
  id: string;
  sessionId: string;
  sectorCode: string;
  rowLabel: string;
  seatNumber: number;
  status: SessionSeatStatus;
  priceCents: number | null;
  createdAt: string;
};

// ─── Payloads ─────────────────────────────────────────────────
export type CreateEventPayload = {
  name: string;
  slug: string;
  description?: string;
  timezone?: string;
  status?: EventStatus;
};

export type UpdateEventPayload = {
  name?: string;
  slug?: string;
  description?: string;
  timezone?: string;
  status?: EventStatus;
};

export type CreateEventDayPayload = {
  date: string;
  label?: string;
};

export type UpdateEventDayPayload = {
  date?: string;
  label?: string;
};

export type CreateSessionPayload = {
  name: string;
  startsAt: string;
  endsAt: string;
  salesStartsAt?: string;
  salesEndsAt?: string;
  priceCents: number;
  currencyCode?: string;
  capacity: number;
  status?: SessionStatus;
};

export type UpdateSessionPayload = {
  name?: string;
  startsAt?: string;
  endsAt?: string;
  salesStartsAt?: string;
  salesEndsAt?: string;
  priceCents?: number;
  currencyCode?: string;
  capacity?: number;
  status?: SessionStatus;
};

export type CreateSeatPayload = {
  sectorCode: string;
  rowLabel: string;
  seatNumber: number;
  priceCents?: number;
  status?: SessionSeatStatus;
};

export type UpdateSeatPayload = {
  status?: SessionSeatStatus;
  priceCents?: number;
};

// ─── Orders ───────────────────────────────────────────────────
export type AdminOrder = {
  id: string;
  tenantId: string;
  sessionId: string;
  status: OrderStatus;
  buyerName: string;
  buyerEmail: string;
  buyerDocument: string | null;
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
  payments: AdminPayment[];
  items: AdminOrderItem[];
};

export type AdminPayment = {
  id: string;
  status: PaymentStatus;
  method: PaymentMethod;
  amountCents: number;
  provider: string;
};

export type AdminOrderItem = {
  id: string;
  unitPriceCents: number;
  seat: {
    id: string;
    sectorCode: string;
    rowLabel: string;
    seatNumber: number;
  };
};

export type AdminOrdersResponse = {
  data: AdminOrder[];
  total: number;
};

export type ApiError = {
  statusCode: number;
  code: string;
  message: string;
  traceId?: string;
};

export type CreateTenantUserPayload = {
  email: string;
  displayName?: string;
  password?: string;
  role: "admin" | "organizer_admin" | "operator";
};

export type TenantUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: string;
  createdAt: string;
};
