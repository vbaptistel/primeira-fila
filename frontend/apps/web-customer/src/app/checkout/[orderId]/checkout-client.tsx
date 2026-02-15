"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label, Separator } from "@primeira-fila/shared";
import { createOrderAction, createPaymentAction } from "./actions";

type CheckoutClientProps = {
  holdId: string;
  eventId: string;
  sessionId: string;
};

type CheckoutStep = "dados" | "pagamento" | "processando" | "concluido";

function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

function HoldTimer({ expiresAt }: { expiresAt: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const target = new Date(expiresAt).getTime();

    const interval = setInterval(() => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining("Expirado");
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setRemaining(`${minutes}:${seconds.toString().padStart(2, "0")}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const isExpiring = remaining !== "Expirado" && remaining.startsWith("0:");

  return (
    <div
      className="rounded-[var(--pf-radius-md)] p-3 text-center text-sm font-medium"
      style={{
        background: isExpiring ? "var(--pf-color-danger)" : "var(--pf-color-accent)",
        color: "white"
      }}
    >
      Reserva expira em: {remaining || "..."}
    </div>
  );
}

export function CheckoutClient({ holdId }: CheckoutClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<CheckoutStep>("dados");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [document, setDocument] = useState("");

  // Order state
  const [orderId, setOrderId] = useState<string | null>(null);
  const [holdExpiresAt, setHoldExpiresAt] = useState<string | null>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<"PIX" | "CREDIT_CARD">("PIX");

  const handleCreateOrder = useCallback(async () => {
    if (!name.trim() || !email.trim()) {
      setError("Nome e e-mail sao obrigatorios.");
      return;
    }

    setError(null);
    setStep("processando");

    const idempotencyKey = generateIdempotencyKey();
    const result = await createOrderAction(
      {
        holdId,
        buyer: {
          name: name.trim(),
          email: email.trim().toLowerCase(),
          document: document.trim() || undefined
        }
      },
      idempotencyKey
    );

    if (result.success) {
      setOrderId(result.order.id);
      setHoldExpiresAt(result.order.holdExpiresAt);
      setStep("pagamento");
    } else {
      setError(result.error);
      setStep("dados");
    }
  }, [holdId, name, email, document]);

  const handlePay = useCallback(async () => {
    if (!orderId) return;

    setError(null);
    setStep("processando");

    const idempotencyKey = generateIdempotencyKey();
    const paymentResult = await createPaymentAction(
      orderId,
      { method: paymentMethod },
      idempotencyKey
    );

    if (paymentResult.success) {
      if (paymentResult.result.order.status === "PAID") {
        setStep("concluido");
        setTimeout(() => {
          router.push(`/pedidos/${orderId}?token=confirmation&email=${encodeURIComponent(email)}`);
        }, 2000);
      } else {
        setError("Pagamento nao aprovado. Tente outro metodo.");
        setStep("pagamento");
      }
    } else {
      setError(paymentResult.error);
      setStep("pagamento");
    }
  }, [orderId, paymentMethod, router, email]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold text-[var(--pf-color-text)] mb-2">Checkout</h1>

      {holdExpiresAt && (
        <div className="mb-6">
          <HoldTimer expiresAt={holdExpiresAt} />
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-[var(--pf-radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Step: Dados do comprador */}
      {step === "dados" && (
        <div className="space-y-6">
          <div className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--pf-color-text)] mb-4">
              Dados do comprador
            </h2>

            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome completo *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Seu nome completo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  required
                />
                <p className="mt-1 text-xs text-[var(--pf-color-muted-text)]">
                  Os ingressos serao enviados para este e-mail.
                </p>
              </div>

              <div>
                <Label htmlFor="document">CPF (opcional)</Label>
                <Input
                  id="document"
                  value={document}
                  onChange={(e) => setDocument(e.target.value)}
                  placeholder="000.000.000-00"
                />
              </div>
            </div>
          </div>

          <Button variant="primary" size="lg" className="w-full" onClick={handleCreateOrder}>
            Continuar para pagamento
          </Button>
        </div>
      )}

      {/* Step: Pagamento */}
      {step === "pagamento" && (
        <div className="space-y-6">
          <div className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-6">
            <h2 className="text-lg font-semibold text-[var(--pf-color-text)] mb-4">
              Forma de pagamento
            </h2>

            <div className="space-y-3">
              <label
                className="flex items-center gap-3 rounded-[var(--pf-radius-md)] border p-4 cursor-pointer transition-colors"
                style={{
                  borderColor: paymentMethod === "PIX" ? "var(--pf-color-primary)" : "var(--pf-color-border)",
                  background: paymentMethod === "PIX" ? "var(--pf-color-primary)08" : "transparent"
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="PIX"
                  checked={paymentMethod === "PIX"}
                  onChange={() => setPaymentMethod("PIX")}
                  className="accent-[var(--pf-color-primary)]"
                />
                <div>
                  <p className="font-medium text-[var(--pf-color-text)]">PIX</p>
                  <p className="text-sm text-[var(--pf-color-muted-text)]">Pagamento instantaneo</p>
                </div>
              </label>

              <label
                className="flex items-center gap-3 rounded-[var(--pf-radius-md)] border p-4 cursor-pointer transition-colors"
                style={{
                  borderColor: paymentMethod === "CREDIT_CARD" ? "var(--pf-color-primary)" : "var(--pf-color-border)",
                  background: paymentMethod === "CREDIT_CARD" ? "var(--pf-color-primary)08" : "transparent"
                }}
              >
                <input
                  type="radio"
                  name="paymentMethod"
                  value="CREDIT_CARD"
                  checked={paymentMethod === "CREDIT_CARD"}
                  onChange={() => setPaymentMethod("CREDIT_CARD")}
                  className="accent-[var(--pf-color-primary)]"
                />
                <div>
                  <p className="font-medium text-[var(--pf-color-text)]">Cartao de credito</p>
                  <p className="text-sm text-[var(--pf-color-muted-text)]">Visa, Mastercard, Elo</p>
                </div>
              </label>
            </div>
          </div>

          <Separator />

          <Button variant="primary" size="lg" className="w-full" onClick={handlePay}>
            Finalizar compra
          </Button>
        </div>
      )}

      {/* Step: Processando */}
      {step === "processando" && (
        <div className="text-center py-16">
          <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-[var(--pf-color-border)] border-t-[var(--pf-color-primary)]" />
          <p className="mt-4 text-lg font-medium text-[var(--pf-color-text)]">Processando...</p>
          <p className="text-sm text-[var(--pf-color-muted-text)]">Aguarde enquanto processamos sua solicitacao.</p>
        </div>
      )}

      {/* Step: Concluido */}
      {step === "concluido" && (
        <div className="text-center py-16">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full" style={{ background: "var(--pf-color-primary)" }}>
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-[var(--pf-color-text)]">Compra confirmada!</h2>
          <p className="mt-2 text-[var(--pf-color-muted-text)]">
            Seus ingressos foram enviados para o e-mail informado.
          </p>
          <p className="text-sm text-[var(--pf-color-muted-text)] mt-1">
            Redirecionando para seus ingressos...
          </p>
        </div>
      )}
    </div>
  );
}
