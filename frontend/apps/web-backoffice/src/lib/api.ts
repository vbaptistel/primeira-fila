import { api } from "./api-client";
import type {
  AdminEvent,
  AdminOrdersResponse,
  AdminSessionSeat,
  CreateEventPayload,
  CreateEventDayPayload,
  CreateSessionPayload,
  CreateSeatPayload,
  UpdateEventPayload,
  UpdateEventDayPayload,
  UpdateSessionPayload,
  UpdateSeatPayload,
  CreateTenantUserPayload,
  TenantUser
} from "@/types/api";

export type {
  AdminEvent,
  AdminOrdersResponse,
  AdminSessionSeat,
  CreateEventPayload,
  CreateEventDayPayload,
  CreateSessionPayload,
  CreateSeatPayload,
  UpdateEventPayload,
  UpdateEventDayPayload,
  UpdateSessionPayload,
  UpdateSeatPayload,
  CreateTenantUserPayload,
  TenantUser
};

type AuthOpts = { token: string };

// ─── Events ───────────────────────────────────────────────────

export function listEvents(tenantId: string, opts: AuthOpts): Promise<AdminEvent[]> {
  return api.get<AdminEvent[]>(`/v1/tenants/${tenantId}/events`, { token: opts.token });
}

export function getEvent(tenantId: string, eventId: string, opts: AuthOpts): Promise<AdminEvent> {
  return api.get<AdminEvent>(`/v1/tenants/${tenantId}/events/${eventId}`, { token: opts.token });
}

export function createEvent(tenantId: string, data: CreateEventPayload, opts: AuthOpts): Promise<AdminEvent> {
  return api.post<AdminEvent>(`/v1/tenants/${tenantId}/events`, data, { token: opts.token });
}

export function updateEvent(tenantId: string, eventId: string, data: UpdateEventPayload, opts: AuthOpts): Promise<AdminEvent> {
  return api.patch<AdminEvent>(`/v1/tenants/${tenantId}/events/${eventId}`, data, { token: opts.token });
}

export function deleteEvent(tenantId: string, eventId: string, opts: AuthOpts): Promise<void> {
  return api.delete<void>(`/v1/tenants/${tenantId}/events/${eventId}`, { token: opts.token });
}

// ─── Days ─────────────────────────────────────────────────────

export function createEventDay(tenantId: string, eventId: string, data: CreateEventDayPayload, opts: AuthOpts) {
  return api.post(`/v1/tenants/${tenantId}/events/${eventId}/days`, data, { token: opts.token });
}

export function updateEventDay(tenantId: string, eventId: string, dayId: string, data: UpdateEventDayPayload, opts: AuthOpts) {
  return api.patch(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}`, data, { token: opts.token });
}

export function deleteEventDay(tenantId: string, eventId: string, dayId: string, opts: AuthOpts): Promise<void> {
  return api.delete<void>(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}`, { token: opts.token });
}

// ─── Sessions ─────────────────────────────────────────────────

export function createSession(tenantId: string, eventId: string, dayId: string, data: CreateSessionPayload, opts: AuthOpts) {
  return api.post(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions`, data, { token: opts.token });
}

export function updateSession(tenantId: string, eventId: string, dayId: string, sessionId: string, data: UpdateSessionPayload, opts: AuthOpts) {
  return api.patch(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}`, data, { token: opts.token });
}

export function deleteSession(tenantId: string, eventId: string, dayId: string, sessionId: string, opts: AuthOpts): Promise<void> {
  return api.delete<void>(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}`, { token: opts.token });
}

// ─── Seats ────────────────────────────────────────────────────

export function listSessionSeats(tenantId: string, eventId: string, dayId: string, sessionId: string, opts: AuthOpts): Promise<AdminSessionSeat[]> {
  return api.get<AdminSessionSeat[]>(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}/seats`, { token: opts.token });
}

export function createSeat(tenantId: string, eventId: string, dayId: string, sessionId: string, data: CreateSeatPayload, opts: AuthOpts) {
  return api.post(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}/seats`, data, { token: opts.token });
}

export function updateSeat(tenantId: string, eventId: string, dayId: string, sessionId: string, seatId: string, data: UpdateSeatPayload, opts: AuthOpts) {
  return api.patch(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}/seats/${seatId}`, data, { token: opts.token });
}

export function deleteSeat(tenantId: string, eventId: string, dayId: string, sessionId: string, seatId: string, opts: AuthOpts): Promise<void> {
  return api.delete<void>(`/v1/tenants/${tenantId}/events/${eventId}/days/${dayId}/sessions/${sessionId}/seats/${seatId}`, { token: opts.token });
}

// ─── Orders ───────────────────────────────────────────────────

export function listOrders(
  tenantId: string,
  params: { status?: string; eventId?: string; sessionId?: string; limit?: number; offset?: number },
  opts: AuthOpts
): Promise<AdminOrdersResponse> {
  const searchParams = new URLSearchParams();
  if (params.status) searchParams.set("status", params.status);
  if (params.eventId) searchParams.set("eventId", params.eventId);
  if (params.sessionId) searchParams.set("sessionId", params.sessionId);
  if (params.limit) searchParams.set("limit", String(params.limit));
  if (params.offset) searchParams.set("offset", String(params.offset));
  const qs = searchParams.toString();
  return api.get<AdminOrdersResponse>(`/v1/tenants/${tenantId}/orders${qs ? `?${qs}` : ""}`, { token: opts.token });
}
// ─── Users ────────────────────────────────────────────────────

export function listTenantUsers(tenantId: string, opts: AuthOpts): Promise<TenantUser[]> {
  return api.get<TenantUser[]>(`/v1/tenants/${tenantId}/users`, { token: opts.token });
}

export function createTenantUser(
  tenantId: string,
  data: CreateTenantUserPayload,
  opts: AuthOpts
): Promise<TenantUser> {
  return api.post<TenantUser>(`/v1/tenants/${tenantId}/users`, data, { token: opts.token });
}
