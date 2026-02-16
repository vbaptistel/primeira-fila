"use server";

import { revalidatePath } from "next/cache";
import { requireSession } from "@/lib/auth";
import { createSeat, updateSeat, deleteSeat } from "@/lib/api";
import type { CreateSeatPayload, UpdateSeatPayload } from "@/types/api";

function seatBasePath(eventId: string, dayId: string, sessionId: string) {
  return `/eventos/${eventId}/dias/${dayId}/sessoes/${sessionId}/assentos`;
}

export async function createSeatAction(
  eventId: string,
  dayId: string,
  sessionId: string,
  data: CreateSeatPayload
) {
  const session = await requireSession();
  await createSeat(session.tenantId, eventId, dayId, sessionId, data, { token: session.accessToken });
  revalidatePath(seatBasePath(eventId, dayId, sessionId));
}

export async function updateSeatStatusAction(
  eventId: string,
  dayId: string,
  sessionId: string,
  seatId: string,
  data: UpdateSeatPayload
) {
  const session = await requireSession();
  await updateSeat(session.tenantId, eventId, dayId, sessionId, seatId, data, { token: session.accessToken });
  revalidatePath(seatBasePath(eventId, dayId, sessionId));
}

export async function deleteSeatAction(
  eventId: string,
  dayId: string,
  sessionId: string,
  seatId: string
) {
  const session = await requireSession();
  await deleteSeat(session.tenantId, eventId, dayId, sessionId, seatId, { token: session.accessToken });
  revalidatePath(seatBasePath(eventId, dayId, sessionId));
}

export async function bulkCreateSeatsAction(
  eventId: string,
  dayId: string,
  sessionId: string,
  seats: CreateSeatPayload[]
) {
  const session = await requireSession();
  for (const seat of seats) {
    await createSeat(session.tenantId, eventId, dayId, sessionId, seat, { token: session.accessToken });
  }
  revalidatePath(seatBasePath(eventId, dayId, sessionId));
}
