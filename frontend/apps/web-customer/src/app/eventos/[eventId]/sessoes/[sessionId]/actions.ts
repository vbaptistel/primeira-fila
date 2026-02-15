"use server";

import { createHold } from "@/lib/api";
import type { HoldResponse } from "@/types/api";

type CreateHoldResult =
  | { success: true; hold: HoldResponse }
  | { success: false; error: string };

export async function createHoldAction(
  sessionId: string,
  seats: { sector: string; row: string; number: number }[]
): Promise<CreateHoldResult> {
  try {
    const hold = await createHold(sessionId, seats);
    return { success: true, hold };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao reservar assentos. Tente novamente.";
    return { success: false, error: message };
  }
}
