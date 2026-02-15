"use server";

import { createOrder, createPayment } from "@/lib/api";
import type {
  CreateOrderRequest,
  CreateOrderResponse,
  CreatePaymentRequest,
  PaymentResponse
} from "@/types/api";

type CreateOrderResult =
  | { success: true; order: CreateOrderResponse }
  | { success: false; error: string };

type CreatePaymentResult =
  | { success: true; result: PaymentResponse }
  | { success: false; error: string };

export async function createOrderAction(
  data: CreateOrderRequest,
  idempotencyKey: string
): Promise<CreateOrderResult> {
  try {
    const order = await createOrder(data, idempotencyKey);
    return { success: true, order };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao criar pedido. Tente novamente.";
    return { success: false, error: message };
  }
}

export async function createPaymentAction(
  orderId: string,
  data: CreatePaymentRequest,
  idempotencyKey: string
): Promise<CreatePaymentResult> {
  try {
    const result = await createPayment(orderId, data, idempotencyKey);
    return { success: true, result };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Erro ao processar pagamento. Tente novamente.";
    return { success: false, error: message };
  }
}
