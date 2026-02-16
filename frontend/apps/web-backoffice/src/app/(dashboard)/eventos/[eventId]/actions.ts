"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import {
  createEventDay,
  updateEventDay,
  deleteEventDay,
  createSession,
  updateSession,
  deleteSession
} from "@/lib/api";
import type {
  CreateEventDayPayload,
  UpdateEventDayPayload,
  CreateSessionPayload,
  UpdateSessionPayload
} from "@/types/api";

export async function createEventDayAction(eventId: string, data: CreateEventDayPayload) {
  const session = await requireSession();
  await createEventDay(session.tenantId, eventId, data, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}

export async function updateEventDayAction(eventId: string, dayId: string, data: UpdateEventDayPayload) {
  const session = await requireSession();
  await updateEventDay(session.tenantId, eventId, dayId, data, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}

export async function deleteEventDayAction(eventId: string, dayId: string) {
  const session = await requireSession();
  await deleteEventDay(session.tenantId, eventId, dayId, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}

export async function createSessionAction(eventId: string, dayId: string, data: CreateSessionPayload) {
  const session = await requireSession();
  await createSession(session.tenantId, eventId, dayId, data, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}

export async function updateSessionAction(eventId: string, dayId: string, sessionId: string, data: UpdateSessionPayload) {
  const session = await requireSession();
  await updateSession(session.tenantId, eventId, dayId, sessionId, data, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}

export async function deleteSessionAction(eventId: string, dayId: string, sessionId: string) {
  const session = await requireSession();
  await deleteSession(session.tenantId, eventId, dayId, sessionId, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
}
