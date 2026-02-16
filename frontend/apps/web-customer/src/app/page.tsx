import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { getTenant } from "@/lib/get-tenant";
import { EventCard } from "@/components/event-card";
import { listPublicEvents, resolveTenantByHost } from "@/lib/api";
import type { PublicEvent } from "@/types/api";

async function EventList(context: { requestHost?: string; tenantId?: string }) {
  let events: PublicEvent[] = [];
  try {
    events = await listPublicEvents(20, {
      requestHost: context.requestHost,
      tenantId: context.tenantId
    });
  } catch {
    // Em caso de falha, mostra lista vazia
  }

  if (events.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        <EventCard empty />
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
      <div className="overflow-hidden rounded-[var(--pf-radius-lg)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
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
    </div>
  );
}

export default async function HomePage() {
  const [tenant, headersList] = await Promise.all([getTenant(), headers()]);
  if (!tenant) notFound();

  const requestHost =
    headersList.get("x-forwarded-host") ?? headersList.get("host") ?? undefined;

  let tenantId = tenant?.id ? tenant.id : undefined;
  if (!tenantId && requestHost) {
    try {
      const resolved = await resolveTenantByHost(requestHost);
      if (resolved.found && resolved.tenant?.id) {
        tenantId = resolved.tenant.id;
      }
    } catch {
      // Ignora falha de resolve; segue sem filtro por tenant
    }
  }
  // Fallback para dev: em localhost, usar tenant fixo se definido (ex.: NEXT_PUBLIC_DEV_TENANT_ID)
  if (!tenantId && requestHost?.startsWith("localhost")) {
    const devTenantId = process.env.NEXT_PUBLIC_DEV_TENANT_ID;
    if (devTenantId?.trim()) {
      tenantId = devTenantId.trim();
    }
  }

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
          <EventList requestHost={requestHost} tenantId={tenantId} />
        </Suspense>
      </section>
    </div>
  );
}
