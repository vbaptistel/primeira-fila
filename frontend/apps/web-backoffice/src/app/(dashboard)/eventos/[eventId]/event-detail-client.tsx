"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea
} from "@primeira-fila/shared";
import { formatDate, formatTime, eventStatusLabels, sessionStatusLabels, formatCurrency } from "@/lib/format";
import { updateEventAction, deleteEventAction } from "../actions";
import {
  createEventDayAction,
  deleteEventDayAction,
  createSessionAction,
  deleteSessionAction
} from "./actions";
import type { AdminEvent, EventStatus } from "@/types/api";

const statusVariant: Record<EventStatus, "primary" | "default" | "danger" | "accent"> = {
  DRAFT: "default",
  PUBLISHED: "primary",
  CANCELLED: "danger",
  ARCHIVED: "accent"
};

type Props = {
  event: AdminEvent;
};

export function EventDetailClient({ event }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [showAddDay, setShowAddDay] = useState(false);
  const [showAddSession, setShowAddSession] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ type: string; id: string; parentId?: string } | null>(null);

  // Edit event state
  const [editName, setEditName] = useState(event.name);
  const [editDescription, setEditDescription] = useState(event.description ?? "");
  const [editStatus, setEditStatus] = useState(event.status);

  // Add day state
  const [dayDate, setDayDate] = useState("");
  const [dayLabel, setDayLabel] = useState("");

  // Add session state
  const [sessionName, setSessionName] = useState("");
  const [sessionStartsAt, setSessionStartsAt] = useState("");
  const [sessionEndsAt, setSessionEndsAt] = useState("");
  const [sessionPriceCents, setSessionPriceCents] = useState("");
  const [sessionCapacity, setSessionCapacity] = useState("");

  function handleSaveEvent() {
    startTransition(async () => {
      await updateEventAction(event.id, {
        name: editName,
        description: editDescription || undefined,
        status: editStatus
      });
      setEditing(false);
    });
  }

  function handleDeleteEvent() {
    startTransition(async () => {
      await deleteEventAction(event.id);
    });
  }

  function handleAddDay() {
    if (!dayDate) return;
    startTransition(async () => {
      await createEventDayAction(event.id, {
        date: dayDate,
        label: dayLabel || undefined
      });
      setShowAddDay(false);
      setDayDate("");
      setDayLabel("");
    });
  }

  function handleAddSession(dayId: string) {
    if (!sessionName || !sessionStartsAt || !sessionEndsAt || !sessionPriceCents || !sessionCapacity) return;
    startTransition(async () => {
      await createSessionAction(event.id, dayId, {
        name: sessionName,
        startsAt: sessionStartsAt,
        endsAt: sessionEndsAt,
        priceCents: Math.round(parseFloat(sessionPriceCents) * 100),
        capacity: parseInt(sessionCapacity, 10)
      });
      setShowAddSession(null);
      setSessionName("");
      setSessionStartsAt("");
      setSessionEndsAt("");
      setSessionPriceCents("");
      setSessionCapacity("");
    });
  }

  function handleConfirmDelete() {
    if (!confirmDelete) return;
    startTransition(async () => {
      if (confirmDelete.type === "event") {
        await deleteEventAction(event.id);
      } else if (confirmDelete.type === "day") {
        await deleteEventDayAction(event.id, confirmDelete.id);
      } else if (confirmDelete.type === "session" && confirmDelete.parentId) {
        await deleteSessionAction(event.id, confirmDelete.parentId, confirmDelete.id);
      }
      setConfirmDelete(null);
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Event Info Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>{event.name}</CardTitle>
            <p className="text-sm text-[var(--pf-color-muted-text)] mt-1">
              Slug: {event.slug} | Timezone: {event.timezone}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant[event.status]}>
              {eventStatusLabels[event.status]}
            </Badge>
            {!editing ? (
              <>
                <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
                  Editar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete({ type: "event", id: event.id })}
                >
                  Excluir
                </Button>
              </>
            ) : null}
          </div>
        </CardHeader>
        {editing ? (
          <CardContent>
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <Label>Nome</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Descricao</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
              </div>
              <div className="flex flex-col gap-1">
                <Label>Status</Label>
                <Select value={editStatus} onValueChange={(val) => setEditStatus(val as EventStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DRAFT">Rascunho</SelectItem>
                    <SelectItem value="PUBLISHED">Publicado</SelectItem>
                    <SelectItem value="CANCELLED">Cancelado</SelectItem>
                    <SelectItem value="ARCHIVED">Arquivado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Button variant="primary" size="sm" onClick={handleSaveEvent} disabled={isPending}>
                  {isPending ? "Salvando..." : "Salvar"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </CardContent>
        ) : event.description ? (
          <CardContent>
            <p className="text-sm text-[var(--pf-color-muted-text)]">{event.description}</p>
          </CardContent>
        ) : null}
      </Card>

      {/* Days & Sessions */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Dias e Sessoes</h2>
        <Button variant="secondary" size="sm" onClick={() => setShowAddDay(true)}>
          Adicionar Dia
        </Button>
      </div>

      {event.eventDays.length === 0 ? (
        <p className="text-[var(--pf-color-muted-text)]">Nenhum dia configurado.</p>
      ) : (
        event.eventDays.map((day) => (
          <Card key={day.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">
                {formatDate(day.date)}
                {day.label ? ` — ${day.label}` : ""}
              </CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => setShowAddSession(day.id)}
                >
                  Adicionar Sessao
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete({ type: "day", id: day.id })}
                >
                  Excluir Dia
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {day.sessions.length === 0 ? (
                <p className="text-sm text-[var(--pf-color-muted-text)]">Nenhuma sessao.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  {day.sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className="flex items-center justify-between p-3 rounded-md border border-[var(--pf-color-border)]"
                    >
                      <div>
                        <p className="font-medium text-sm">{sess.name}</p>
                        <p className="text-xs text-[var(--pf-color-muted-text)]">
                          {formatTime(sess.startsAt)} - {formatTime(sess.endsAt)} | {formatCurrency(sess.priceCents)} | Cap: {sess.capacity}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={sess.status === "PUBLISHED" ? "primary" : "default"}>
                          {sessionStatusLabels[sess.status]}
                        </Badge>
                        <Link href={`/eventos/${event.id}/dias/${day.id}/sessoes/${sess.id}/assentos`}>
                          <Button variant="ghost" size="sm">Assentos</Button>
                        </Link>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setConfirmDelete({ type: "session", id: sess.id, parentId: day.id })}
                        >
                          Excluir
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}

      {/* Add Day Dialog */}
      <Dialog open={showAddDay} onOpenChange={setShowAddDay}>
        <DialogHeader>
          <DialogTitle>Adicionar Dia</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Data</Label>
            <Input type="date" value={dayDate} onChange={(e) => setDayDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Label (opcional)</Label>
            <Input placeholder="Ex: Dia 1" value={dayLabel} onChange={(e) => setDayLabel(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowAddDay(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleAddDay} disabled={isPending}>
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Add Session Dialog */}
      <Dialog open={showAddSession !== null} onOpenChange={() => setShowAddSession(null)}>
        <DialogHeader>
          <DialogTitle>Adicionar Sessao</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Nome</Label>
            <Input placeholder="Nome da sessao" value={sessionName} onChange={(e) => setSessionName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Inicio</Label>
            <Input type="datetime-local" value={sessionStartsAt} onChange={(e) => setSessionStartsAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Fim</Label>
            <Input type="datetime-local" value={sessionEndsAt} onChange={(e) => setSessionEndsAt(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Preco (R$)</Label>
            <Input type="number" step="0.01" placeholder="0.00" value={sessionPriceCents} onChange={(e) => setSessionPriceCents(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Capacidade</Label>
            <Input type="number" placeholder="100" value={sessionCapacity} onChange={(e) => setSessionCapacity(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowAddSession(null)}>Cancelar</Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => showAddSession && handleAddSession(showAddSession)}
            disabled={isPending}
          >
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Confirm Delete Dialog */}
      <Dialog open={confirmDelete !== null} onOpenChange={() => setConfirmDelete(null)}>
        <DialogHeader>
          <DialogTitle>Confirmar Exclusao</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-[var(--pf-color-muted-text)]">
          Tem certeza que deseja excluir? Esta acao nao pode ser desfeita.
        </p>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(null)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleConfirmDelete} disabled={isPending}>
            {isPending ? "Excluindo..." : "Excluir"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
