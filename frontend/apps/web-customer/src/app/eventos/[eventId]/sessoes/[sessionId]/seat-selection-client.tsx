"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge, Button } from "@primeira-fila/shared";
import { createHoldAction } from "./actions";
import type { PublicSessionSeat, SessionSeatStatus } from "@/types/api";

type SeatSelectionClientProps = {
  eventId: string;
  sessionId: string;
  seats: PublicSessionSeat[];
};

type SectorGroup = {
  sectorCode: string;
  seats: PublicSessionSeat[];
};

function groupBySector(seats: PublicSessionSeat[]): SectorGroup[] {
  const map = new Map<string, PublicSessionSeat[]>();
  for (const seat of seats) {
    const existing = map.get(seat.sectorCode) ?? [];
    existing.push(seat);
    map.set(seat.sectorCode, existing);
  }
  return Array.from(map.entries()).map(([sectorCode, seats]) => ({
    sectorCode,
    seats: seats.sort((a, b) => {
      if (a.rowLabel !== b.rowLabel) return a.rowLabel.localeCompare(b.rowLabel);
      return a.seatNumber - b.seatNumber;
    })
  }));
}

function getSeatStatusColor(status: SessionSeatStatus, isSelected: boolean): string {
  if (isSelected) return "var(--pf-color-primary)";
  switch (status) {
    case "AVAILABLE":
      return "var(--pf-color-accent)";
    case "HELD":
    case "SOLD":
    case "BLOCKED":
      return "var(--pf-color-border)";
    default:
      return "var(--pf-color-border)";
  }
}

export function SeatSelectionClient({ eventId, sessionId, seats }: SeatSelectionClientProps) {
  const router = useRouter();
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSeat = useCallback((seat: PublicSessionSeat) => {
    if (seat.status !== "AVAILABLE") return;

    setSelectedSeats((prev) => {
      const next = new Set(prev);
      const key = seat.id;
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const handleCreateHold = async () => {
    if (selectedSeats.size === 0) return;

    setCreating(true);
    setError(null);

    const selectedSeatData = seats
      .filter((s) => selectedSeats.has(s.id))
      .map((s) => ({
        sector: s.sectorCode,
        row: s.rowLabel,
        number: s.seatNumber
      }));

    const result = await createHoldAction(sessionId, selectedSeatData);
    if (result.success) {
      router.push(`/checkout/${result.hold.holdId}?eventId=${eventId}&sessionId=${sessionId}`);
    } else {
      setError(result.error);
      setCreating(false);
    }
  };

  const sectors = groupBySector(seats);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[var(--pf-color-text)]">Selecione seus assentos</h1>
        <p className="text-sm text-[var(--pf-color-muted-text)] mt-1">
          Clique nos assentos disponiveis para seleciona-los.
        </p>
      </div>

      {/* Legenda */}
      <div className="flex items-center gap-6 mb-6 text-sm">
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded" style={{ background: "var(--pf-color-accent)" }} />
          <span className="text-[var(--pf-color-muted-text)]">Disponivel</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded" style={{ background: "var(--pf-color-primary)" }} />
          <span className="text-[var(--pf-color-muted-text)]">Selecionado</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block h-4 w-4 rounded" style={{ background: "var(--pf-color-border)" }} />
          <span className="text-[var(--pf-color-muted-text)]">Indisponivel</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-[var(--pf-radius-md)] border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Mapa de setores */}
      <div className="space-y-8">
        {sectors.map((sector) => (
          <div key={sector.sectorCode}>
            <div className="flex items-center gap-2 mb-4">
              <Badge variant="accent">{sector.sectorCode}</Badge>
              <span className="text-sm text-[var(--pf-color-muted-text)]">
                {sector.seats.filter((s) => s.status === "AVAILABLE").length} disponiveis
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {sector.seats.map((seat) => {
                const isSelected = selectedSeats.has(seat.id);
                const isAvailable = seat.status === "AVAILABLE";

                return (
                  <button
                    key={seat.id}
                    onClick={() => toggleSeat(seat)}
                    disabled={!isAvailable}
                    title={`${seat.sectorCode} ${seat.rowLabel}${seat.seatNumber}`}
                    className="flex h-9 w-9 items-center justify-center rounded text-xs font-semibold transition-all"
                    style={{
                      background: getSeatStatusColor(seat.status, isSelected),
                      color: isSelected || isAvailable ? "white" : "var(--pf-color-muted-text)",
                      cursor: isAvailable ? "pointer" : "not-allowed",
                      opacity: isAvailable || isSelected ? 1 : 0.5,
                      transform: isSelected ? "scale(1.1)" : undefined
                    }}
                  >
                    {seat.seatNumber}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer fixo de acao */}
      {selectedSeats.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--pf-color-border)] bg-[var(--pf-color-surface)] p-4 shadow-lg">
          <div className="mx-auto flex max-w-5xl items-center justify-between">
            <div>
              <p className="font-semibold text-[var(--pf-color-text)]">
                {selectedSeats.size} {selectedSeats.size === 1 ? "assento selecionado" : "assentos selecionados"}
              </p>
            </div>
            <Button
              variant="primary"
              size="lg"
              onClick={handleCreateHold}
              disabled={creating}
            >
              {creating ? "Reservando..." : "Continuar"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
