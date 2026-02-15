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

export type ResolveTenantResponse = {
  found: boolean;
  tenant: TenantBranding | null;
};

/** Resolve tenant por host (subdominio ou dominio customizado). Usado em SSR quando o cookie ainda nao foi setado. */
export function resolveTenantByHost(host: string): Promise<ResolveTenantResponse> {
  return api.get<ResolveTenantResponse>(
    `/v1/public/tenants/resolve?domain=${encodeURIComponent(host)}`
  );
}

// ─── Events ────────────────────────────────────────────────────

export type EventsRequestContext = {
  /** Host do request original (ex.: subdominio.primeirafila.app); repassado como X-Forwarded-Host para o backend resolver o tenant. */
  requestHost?: string;
  /** ID do tenant quando conhecido (ex.: do cookie em SSR); fallback quando o host nao resolve no backend (ex.: localhost). */
  tenantId?: string;
};

export function listPublicEvents(
  limit = 20,
  context?: EventsRequestContext
): Promise<PublicEvent[]> {
  const headers: Record<string, string> = {};
  if (context?.requestHost) headers["X-Forwarded-Host"] = context.requestHost;
  if (context?.tenantId) headers["X-Tenant-Id"] = context.tenantId;
  return api.get<PublicEvent[]>(`/v1/events?limit=${limit}`, {
    headers: Object.keys(headers).length ? headers : undefined
  });
}

export function getPublicEvent(
  eventId: string,
  context?: EventsRequestContext
): Promise<PublicEvent> {
  const headers: Record<string, string> = {};
  if (context?.requestHost) headers["X-Forwarded-Host"] = context.requestHost;
  if (context?.tenantId) headers["X-Tenant-Id"] = context.tenantId;
  return api.get<PublicEvent>(`/v1/events/${eventId}`, {
    headers: Object.keys(headers).length ? headers : undefined
  });
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
