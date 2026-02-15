import Link from "next/link";
import { Badge } from "@primeira-fila/shared";
import type { PublicEvent } from "@/types/api";
import { formatCurrency, formatDate, getMinPrice } from "@/lib/format";

const cardClassName =
  "block overflow-hidden rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]";

type EventCardProps =
  | { event: PublicEvent; empty?: never }
  | { event?: never; empty: true };

export function EventCard(props: EventCardProps) {
  if (props.empty) {
    return (
      <div className={cardClassName}>
        <div className="relative h-48 bg-[var(--pf-color-border)]/[0.15] flex items-center justify-center">
          <div className="text-center px-4">
            <p className="text-lg text-[var(--pf-color-text)]">
              Nenhum evento disponivel no momento.
            </p>
            <p className="text-sm text-[var(--pf-color-muted-text)] mt-2">
              Volte em breve para conferir novos eventos!
            </p>
          </div>
        </div>
      </div>
    );
  }

  const event = props.event;
  const firstDay = event.eventDays[0];
  const minPrice = getMinPrice(event.eventDays);
  const totalSessions = event.eventDays.reduce(
    (acc, day) => acc + day.sessions.length,
    0
  );

  return (
    <Link
      href={`/eventos/${event.id}`}
      className={`group ${cardClassName} transition-shadow hover:shadow-lg`}
    >
      {/* Placeholder visual para imagem do evento */}
      <div className="relative h-48 bg-gradient-to-br from-[var(--pf-color-primary)] to-[var(--pf-color-accent)] flex items-end p-4">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10">
          <h3 className="text-lg font-bold text-white line-clamp-2">{event.name}</h3>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm text-[var(--pf-color-muted-text)]">
          <svg className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {firstDay && <span>{formatDate(firstDay.date)}</span>}
          {event.eventDays.length > 1 && (
            <Badge variant="outline">+{event.eventDays.length - 1} dias</Badge>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-[var(--pf-color-muted-text)]">
            {totalSessions} {totalSessions === 1 ? "sessao" : "sessoes"}
          </div>

          {minPrice && (
            <div className="text-right">
              <span className="text-xs text-[var(--pf-color-muted-text)]">a partir de</span>
              <p className="text-base font-bold text-[var(--pf-color-primary)]">
                {formatCurrency(minPrice.priceCents, minPrice.currencyCode)}
              </p>
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
