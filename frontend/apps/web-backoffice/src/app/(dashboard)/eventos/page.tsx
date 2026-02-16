import Link from "next/link";
import { requireSession } from "@/lib/auth";
import { listEvents } from "@/lib/api";
import { formatDate, eventStatusLabels } from "@/lib/format";
import {
  Badge,
  Button,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from "@primeira-fila/shared";
import type { EventStatus } from "@/types/api";

const statusVariant: Record<EventStatus, "primary" | "default" | "danger" | "accent"> = {
  DRAFT: "default",
  PUBLISHED: "primary",
  CANCELLED: "danger",
  ARCHIVED: "accent"
};

export default async function EventosPage() {
  const session = await requireSession();
  const events = await listEvents(session.tenantId, { token: session.accessToken });

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Eventos</h1>
        <Link href="/eventos/novo">
          <Button variant="primary" size="md">Novo Evento</Button>
        </Link>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Dias</TableHead>
            <TableHead>Criado em</TableHead>
            <TableHead>Acoes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 ? (
            <TableRow>
              <TableCell colSpan={5} className="text-center text-[var(--pf-color-muted-text)] py-8">
                Nenhum evento encontrado.
              </TableCell>
            </TableRow>
          ) : (
            events.map((event) => (
              <TableRow key={event.id}>
                <TableCell className="font-medium">{event.name}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant[event.status]}>
                    {eventStatusLabels[event.status]}
                  </Badge>
                </TableCell>
                <TableCell>{event.eventDays?.length ?? 0}</TableCell>
                <TableCell>{formatDate(event.createdAt)}</TableCell>
                <TableCell>
                  <Link href={`/eventos/${event.id}`}>
                    <Button variant="ghost" size="sm">Detalhes</Button>
                  </Link>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
