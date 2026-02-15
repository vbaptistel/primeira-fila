import { headers } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Badge, Separator } from "@primeira-fila/shared";
import { Button } from "@primeira-fila/shared";
import { getPublicEvent, resolveTenantByHost } from "@/lib/api";
import { getTenant } from "@/lib/get-tenant";
import { formatCurrency, formatDate, formatTime } from "@/lib/format";
import type { PublicEvent, PublicSession } from "@/types/api";

type PageProps = {
  params: Promise<{ eventId: string }>;
};

function SessionCard({ session, eventId }: { session: PublicSession; eventId: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-[var(--pf-radius-md)] border border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-4">
      <div className="flex-1 min-w-0">
        <h4 className="font-semibold text-[var(--pf-color-text)] truncate">{session.name}</h4>
        <div className="flex items-center gap-3 mt-1 text-sm text-[var(--pf-color-muted-text)]">
          <span>{formatTime(session.startsAt)} - {formatTime(session.endsAt)}</span>
          <Badge variant="primary">
            {formatCurrency(session.priceCents, session.currencyCode)}
          </Badge>
        </div>
      </div>

      <Link href={`/eventos/${eventId}/sessoes/${session.id}`}>
        <Button variant="primary" size="sm">
          Selecionar
        </Button>
      </Link>
    </div>
  );
}

export default async function EventDetailPage({ params }: PageProps) {
  const { eventId } = await params;
  const [tenant, headersList] = await Promise.all([getTenant(), headers()]);
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
      // Ignora falha de resolve
    }
  }
  if (!tenantId && requestHost?.startsWith("localhost")) {
    const devTenantId = process.env.NEXT_PUBLIC_DEV_TENANT_ID;
    if (devTenantId?.trim()) tenantId = devTenantId.trim();
  }

  let event: PublicEvent;
  try {
    event = await getPublicEvent(eventId, {
      requestHost,
      tenantId
    });
  } catch {
    notFound();
  }

  return (
    <div>
      {/* Event Header */}
      <section
        className="relative py-12 sm:py-16"
        style={{
          background: "linear-gradient(135deg, var(--pf-color-primary) 0%, var(--pf-color-accent) 100%)"
        }}
      >
        <div className="absolute inset-0 bg-black/30" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="text-white">
            <Badge variant="default" className="mb-4 bg-white/20 text-white border-white/30">
              {event.eventDays.length} {event.eventDays.length === 1 ? "dia" : "dias"}
            </Badge>
            <h1 className="text-3xl font-bold sm:text-4xl">{event.name}</h1>
            {event.description && (
              <p className="mt-4 text-lg text-white/80 max-w-2xl">{event.description}</p>
            )}
          </div>
        </div>
      </section>

      {/* Sessions per day */}
      <section className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {event.eventDays.map((day) => (
          <div key={day.id} className="mb-10 last:mb-0">
            <div className="mb-4">
              <h3 className="text-xl font-bold text-[var(--pf-color-text)]">
                {formatDate(day.date)}
              </h3>
              <Separator className="mt-3" />
            </div>

            <div className="space-y-3">
              {day.sessions.map((session) => (
                <SessionCard
                  key={session.id}
                  session={session}
                  eventId={event.id}
                />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
