import { api } from "./api-client";
import type { TenantBranding } from "@/types/tenant";
import type {
  PublicEvent,
  PublicSessionSeat,
  HoldResponse,
  CreateOrderRequest,
  CreateOrderResponse,
  CreatePaymentRequest,
  PaymentResponse,
  OrderResponse,
  TicketResponse
} from "@/types/api";

// ─── Tenant ────────────────────────────────────────────────────

export function resolveTenant(host: string): Promise<TenantBranding> {
  return api.get<TenantBranding>("/v1/public/tenants/resolve", {
    headers: { Host: host }
  });
}

// ─── Events ────────────────────────────────────────────────────

export function listPublicEvents(limit = 20): Promise<PublicEvent[]> {
  return api.get<PublicEvent[]>(`/v1/events?limit=${limit}`);
}

export function getPublicEvent(eventId: string): Promise<PublicEvent> {
  return api.get<PublicEvent>(`/v1/events/${eventId}`);
}

// ─── Sessions & Seats ──────────────────────────────────────────

export function getSessionSeats(sessionId: string): Promise<PublicSessionSeat[]> {
  return api.get<PublicSessionSeat[]>(`/v1/sessions/${sessionId}/seats`);
}

export function createHold(
  sessionId: string,
  seats: { sector: string; row: string; number: number }[]
): Promise<HoldResponse> {
  return api.post<HoldResponse>(`/v1/sessions/${sessionId}/holds`, { seats });
}

// ─── Orders ────────────────────────────────────────────────────

export function createOrder(
  data: CreateOrderRequest,
  idempotencyKey: string
): Promise<CreateOrderResponse> {
  return api.post<CreateOrderResponse>("/v1/orders", data, { idempotencyKey });
}

export function createPayment(
  orderId: string,
  data: CreatePaymentRequest,
  idempotencyKey: string
): Promise<PaymentResponse> {
  return api.post<PaymentResponse>(`/v1/orders/${orderId}/payments`, data, { idempotencyKey });
}

export function getOrderByToken(
  orderId: string,
  token: string,
  email: string
): Promise<OrderResponse> {
  return api.get<OrderResponse>(
    `/v1/orders/${orderId}?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
  );
}

export function getOrderTickets(
  orderId: string,
  token?: string,
  email?: string
): Promise<TicketResponse[]> {
  const params = token && email
    ? `?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`
    : "";
  return api.get<TicketResponse[]>(`/v1/orders/${orderId}/tickets${params}`);
}

export function requestOrderAccess(email: string): Promise<{ message: string }> {
  return api.post<{ message: string }>("/v1/orders/request-access", { email });
}
