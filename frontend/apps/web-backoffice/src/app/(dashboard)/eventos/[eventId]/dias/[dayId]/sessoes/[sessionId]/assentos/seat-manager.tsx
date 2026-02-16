"use client";

import { useState, useTransition } from "react";
import {
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
  Label
} from "@primeira-fila/shared";
import { seatStatusLabels } from "@/lib/format";
import { createSeatAction, updateSeatStatusAction, deleteSeatAction, bulkCreateSeatsAction } from "./actions";
import type { AdminSessionSeat, SessionSeatStatus } from "@/types/api";

const statusColors: Record<SessionSeatStatus, string> = {
  AVAILABLE: "bg-green-500",
  HELD: "bg-yellow-500",
  SOLD: "bg-red-500",
  BLOCKED: "bg-gray-400"
};

type Props = {
  eventId: string;
  dayId: string;
  sessionId: string;
  seats: AdminSessionSeat[];
};

export function SeatManager({ eventId, dayId, sessionId, seats }: Props) {
  const [isPending, startTransition] = useTransition();
  const [showAddSeat, setShowAddSeat] = useState(false);
  const [showBulkAdd, setShowBulkAdd] = useState(false);

  // Single seat form
  const [sectorCode, setSectorCode] = useState("");
  const [rowLabel, setRowLabel] = useState("");
  const [seatNumber, setSeatNumber] = useState("");

  // Bulk add form
  const [bulkSector, setBulkSector] = useState("");
  const [bulkRow, setBulkRow] = useState("");
  const [bulkFrom, setBulkFrom] = useState("");
  const [bulkTo, setBulkTo] = useState("");

  // Group seats by sector then row
  const grouped = seats.reduce<Record<string, Record<string, AdminSessionSeat[]>>>((acc, seat) => {
    if (!acc[seat.sectorCode]) acc[seat.sectorCode] = {};
    if (!acc[seat.sectorCode][seat.rowLabel]) acc[seat.sectorCode][seat.rowLabel] = [];
    acc[seat.sectorCode][seat.rowLabel].push(seat);
    return acc;
  }, {});

  // Sort seats within each row
  for (const sector of Object.values(grouped)) {
    for (const row of Object.keys(sector)) {
      sector[row].sort((a, b) => a.seatNumber - b.seatNumber);
    }
  }

  function handleToggleSeat(seat: AdminSessionSeat) {
    if (seat.status !== "AVAILABLE" && seat.status !== "BLOCKED") return;
    const newStatus: SessionSeatStatus = seat.status === "AVAILABLE" ? "BLOCKED" : "AVAILABLE";
    startTransition(async () => {
      await updateSeatStatusAction(eventId, dayId, sessionId, seat.id, { status: newStatus });
    });
  }

  function handleDeleteSeat(seat: AdminSessionSeat) {
    if (seat.status !== "AVAILABLE" && seat.status !== "BLOCKED") return;
    startTransition(async () => {
      await deleteSeatAction(eventId, dayId, sessionId, seat.id);
    });
  }

  function handleAddSeat() {
    if (!sectorCode || !rowLabel || !seatNumber) return;
    startTransition(async () => {
      await createSeatAction(eventId, dayId, sessionId, {
        sectorCode,
        rowLabel,
        seatNumber: parseInt(seatNumber, 10)
      });
      setShowAddSeat(false);
      setSectorCode("");
      setRowLabel("");
      setSeatNumber("");
    });
  }

  function handleBulkAdd() {
    if (!bulkSector || !bulkRow || !bulkFrom || !bulkTo) return;
    const from = parseInt(bulkFrom, 10);
    const to = parseInt(bulkTo, 10);
    if (from > to) return;
    const seatsToCreate: { sectorCode: string; rowLabel: string; seatNumber: number }[] = [];
    for (let i = from; i <= to; i++) {
      seatsToCreate.push({ sectorCode: bulkSector, rowLabel: bulkRow, seatNumber: i });
    }
    startTransition(async () => {
      await bulkCreateSeatsAction(eventId, dayId, sessionId, seatsToCreate);
      setShowBulkAdd(false);
      setBulkSector("");
      setBulkRow("");
      setBulkFrom("");
      setBulkTo("");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setShowAddSeat(true)}>
          Adicionar Assento
        </Button>
        <Button variant="secondary" size="sm" onClick={() => setShowBulkAdd(true)}>
          Adicionar em Lote
        </Button>
      </div>

      {/* Legend */}
      <div className="flex gap-4 text-xs">
        {(Object.entries(statusColors) as [SessionSeatStatus, string][]).map(([status, color]) => (
          <div key={status} className="flex items-center gap-1">
            <div className={`w-3 h-3 rounded ${color}`} />
            <span>{seatStatusLabels[status]}</span>
          </div>
        ))}
      </div>

      {Object.keys(grouped).length === 0 ? (
        <p className="text-[var(--pf-color-muted-text)]">Nenhum assento configurado.</p>
      ) : (
        Object.entries(grouped).map(([sector, rows]) => (
          <Card key={sector}>
            <CardHeader>
              <CardTitle className="text-base">Setor {sector}</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.entries(rows).map(([row, rowSeats]) => (
                <div key={row} className="flex items-center gap-2 mb-3">
                  <span className="text-xs font-semibold w-8 text-[var(--pf-color-muted-text)]">{row}</span>
                  <div className="flex gap-1 flex-wrap">
                    {rowSeats.map((seat) => (
                      <button
                        key={seat.id}
                        onClick={() => handleToggleSeat(seat)}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          handleDeleteSeat(seat);
                        }}
                        disabled={isPending || (seat.status !== "AVAILABLE" && seat.status !== "BLOCKED")}
                        className={`w-8 h-8 rounded text-xs font-medium text-white flex items-center justify-center transition-opacity ${statusColors[seat.status]} ${
                          seat.status === "AVAILABLE" || seat.status === "BLOCKED"
                            ? "cursor-pointer hover:opacity-80"
                            : "cursor-not-allowed opacity-60"
                        }`}
                        title={`${seat.sectorCode}-${seat.rowLabel}${seat.seatNumber} (${seatStatusLabels[seat.status]})`}
                      >
                        {seat.seatNumber}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Add Single Seat Dialog */}
      <Dialog open={showAddSeat} onOpenChange={setShowAddSeat}>
        <DialogHeader>
          <DialogTitle>Adicionar Assento</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Setor</Label>
            <Input placeholder="A" value={sectorCode} onChange={(e) => setSectorCode(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Fileira</Label>
            <Input placeholder="1" value={rowLabel} onChange={(e) => setRowLabel(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Numero</Label>
            <Input type="number" placeholder="1" value={seatNumber} onChange={(e) => setSeatNumber(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowAddSeat(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleAddSeat} disabled={isPending}>
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </Dialog>

      {/* Bulk Add Dialog */}
      <Dialog open={showBulkAdd} onOpenChange={setShowBulkAdd}>
        <DialogHeader>
          <DialogTitle>Adicionar Assentos em Lote</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label>Setor</Label>
            <Input placeholder="A" value={bulkSector} onChange={(e) => setBulkSector(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Fileira</Label>
            <Input placeholder="1" value={bulkRow} onChange={(e) => setBulkRow(e.target.value)} />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col gap-1 flex-1">
              <Label>De</Label>
              <Input type="number" placeholder="1" value={bulkFrom} onChange={(e) => setBulkFrom(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1 flex-1">
              <Label>Ate</Label>
              <Input type="number" placeholder="20" value={bulkTo} onChange={(e) => setBulkTo(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="sm" onClick={() => setShowBulkAdd(false)}>Cancelar</Button>
          <Button variant="primary" size="sm" onClick={handleBulkAdd} disabled={isPending}>
            {isPending ? "Adicionando..." : "Adicionar"}
          </Button>
        </DialogFooter>
      </Dialog>
    </div>
  );
}
