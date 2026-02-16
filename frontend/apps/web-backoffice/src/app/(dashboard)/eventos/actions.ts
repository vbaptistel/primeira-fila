"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/auth";
import { createEvent, updateEvent, deleteEvent } from "@/lib/api";
import type { CreateEventPayload, UpdateEventPayload } from "@/types/api";

export async function createEventAction(data: CreateEventPayload) {
  const session = await requireSession();
  const event = await createEvent(session.tenantId, data, { token: session.accessToken });
  redirect(`/eventos/${event.id}`);
}

export async function updateEventAction(eventId: string, data: UpdateEventPayload) {
  const session = await requireSession();
  await updateEvent(session.tenantId, eventId, data, { token: session.accessToken });
  revalidatePath(`/eventos/${eventId}`);
  revalidatePath("/eventos");
}

export async function deleteEventAction(eventId: string) {
  const session = await requireSession();
  await deleteEvent(session.tenantId, eventId, { token: session.accessToken });
  revalidatePath("/eventos");
  redirect("/eventos");
}
