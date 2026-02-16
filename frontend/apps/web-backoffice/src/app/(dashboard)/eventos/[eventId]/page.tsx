import Link from "next/link";
import { Button } from "@primeira-fila/shared";
import { requireSession } from "@/lib/auth";
import { getEvent } from "@/lib/api";
import { EventDetailClient } from "./event-detail-client";

type Props = {
  params: Promise<{ eventId: string }>;
};

export default async function EventDetailPage({ params }: Props) {
  const { eventId } = await params;
  const session = await requireSession();
  const event = await getEvent(session.tenantId, eventId, { token: session.accessToken });

  return (
    <div>
      <div className="mb-6">
        <Link href="/eventos">
          <Button variant="ghost" size="sm">Voltar para Eventos</Button>
        </Link>
      </div>
      <EventDetailClient event={event} />
    </div>
  );
}
