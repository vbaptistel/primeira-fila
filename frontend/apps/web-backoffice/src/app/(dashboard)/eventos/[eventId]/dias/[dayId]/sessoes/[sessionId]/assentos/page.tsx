import Link from "next/link";
import { Button } from "@primeira-fila/shared";
import { requireSession } from "@/lib/auth";
import { listSessionSeats } from "@/lib/api";
import { SeatManager } from "./seat-manager";

type Props = {
  params: Promise<{
    eventId: string;
    dayId: string;
    sessionId: string;
  }>;
};

export default async function AssentosPage({ params }: Props) {
  const { eventId, dayId, sessionId } = await params;
  const session = await requireSession();
  const seats = await listSessionSeats(session.tenantId, eventId, dayId, sessionId, {
    token: session.accessToken
  });

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Link href={`/eventos/${eventId}`}>
          <Button variant="ghost" size="sm">Voltar ao Evento</Button>
        </Link>
        <h1 className="text-2xl font-bold">Configurar Assentos</h1>
      </div>

      <SeatManager
        eventId={eventId}
        dayId={dayId}
        sessionId={sessionId}
        seats={seats}
      />
    </div>
  );
}
