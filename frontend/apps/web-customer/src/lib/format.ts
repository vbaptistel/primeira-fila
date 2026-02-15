/**
 * Formata valor em centavos para moeda brasileira.
 */
export function formatCurrency(cents: number, currencyCode = "BRL"): string {
  const value = cents / 100;
  if (currencyCode === "BRL") {
    return `R$ ${value.toFixed(2).replace(".", ",")}`;
  }
  return `${currencyCode} ${value.toFixed(2)}`;
}

/**
 * Formata data ISO para exibicao em portugues.
 */
export function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

/**
 * Formata hora de uma data ISO.
 */
export function formatTime(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

/**
 * Formata data e hora.
 */
export function formatDateTime(isoDate: string): string {
  return `${formatDate(isoDate)} as ${formatTime(isoDate)}`;
}

/**
 * Calcula o preco minimo entre as sessoes de um evento.
 */
export function getMinPrice(
  eventDays: { sessions: { priceCents: number; currencyCode: string }[] }[]
): { priceCents: number; currencyCode: string } | null {
  let min: { priceCents: number; currencyCode: string } | null = null;

  for (const day of eventDays) {
    for (const session of day.sessions) {
      if (!min || session.priceCents < min.priceCents) {
        min = { priceCents: session.priceCents, currencyCode: session.currencyCode };
      }
    }
  }

  return min;
}
