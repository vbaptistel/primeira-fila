"use server";

import { requestOrderAccess } from "@/lib/api";

type RequestOrderAccessResult =
  | { success: true; message: string }
  | { success: false; error: string };

export async function requestOrderAccessAction(email: string): Promise<RequestOrderAccessResult> {
  try {
    const { message } = await requestOrderAccess(email);
    return { success: true, message };
  } catch (err) {
    const error =
      err instanceof Error ? err.message : "Erro ao solicitar acesso. Tente novamente.";
    return { success: false, error };
  }
}
