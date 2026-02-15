"use client";

import { useState, useCallback } from "react";
import { Button, Input, Label } from "@primeira-fila/shared";
import { requestOrderAccessAction } from "./actions";

export default function OrdersAccessPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("Informe seu e-mail.");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await requestOrderAccessAction(email.trim().toLowerCase());
    if (result.success) {
      setSuccess(true);
    } else {
      setError(result.error);
    }
    setLoading(false);
  }, [email]);

  return (
    <div className="mx-auto max-w-md px-4 py-16 sm:px-6 lg:px-8">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--pf-color-text)]">
          Acessar meus ingressos
        </h1>
        <p className="mt-2 text-sm text-[var(--pf-color-muted-text)]">
          Informe o e-mail usado na compra para receber um link de acesso aos seus ingressos.
        </p>
      </div>

      {success ? (
        <div className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full" style={{ background: "var(--pf-color-primary)" }}>
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-[var(--pf-color-text)]">E-mail enviado!</h2>
          <p className="mt-2 text-sm text-[var(--pf-color-muted-text)]">
            Se existirem pedidos para este e-mail, voce recebera um link de acesso em instantes.
            Verifique sua caixa de entrada e spam.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-6">
            {error && (
              <div className="mb-4 rounded-[var(--pf-radius-md)] border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <div>
              <Label htmlFor="email">E-mail da compra</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                required
                autoFocus
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Enviando..." : "Enviar link de acesso"}
          </Button>
        </form>
      )}
    </div>
  );
}
