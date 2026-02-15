import { Suspense } from "react";
import { Skeleton } from "@primeira-fila/shared";
import { getTenant } from "@/lib/get-tenant";
import { EventCard } from "@/components/event-card";
import { listPublicEvents } from "@/lib/api";
import type { PublicEvent } from "@/types/api";

async function EventList() {
  let events: PublicEvent[] = [];
  try {
    events = await listPublicEvents();
  } catch {
    // Em caso de falha, mostra lista vazia
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-lg text-[var(--pf-color-muted-text)]">
          Nenhum evento disponivel no momento.
        </p>
        <p className="text-sm text-[var(--pf-color-muted-text)] mt-2">
          Volte em breve para conferir novos eventos!
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}

function EventListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
          <Skeleton className="h-48 w-full rounded-none" />
          <div className="p-4 space-y-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-6 w-24" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export default async function HomePage() {
  const tenant = await getTenant();

  return (
    <div>
      {/* Hero Section */}
      <section
        className="relative py-16 sm:py-24"
        style={{
          background: `linear-gradient(135deg, ${tenant.primaryColor}15 0%, ${tenant.accentColor}10 50%, var(--pf-color-background) 100%)`
        }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl" style={{ color: "var(--pf-color-text)" }}>
              {tenant.name}
            </h1>
            <p className="mt-4 text-lg text-[var(--pf-color-muted-text)] max-w-2xl mx-auto">
              Encontre os melhores eventos e garanta seus ingressos com facilidade.
            </p>
          </div>
        </div>
      </section>

      {/* Event Listing */}
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-[var(--pf-color-text)]">Eventos disponiveis</h2>
        </div>

        <Suspense fallback={<EventListSkeleton />}>
          <EventList />
        </Suspense>
      </section>
    </div>
  );
}
