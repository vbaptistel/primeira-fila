import { notFound } from "next/navigation";
import { getSessionSeats } from "@/lib/api";
import { SeatSelectionClient } from "./seat-selection-client";

type PageProps = {
  params: Promise<{ eventId: string; sessionId: string }>;
};

export default async function SeatSelectionPage({ params }: PageProps) {
  const { eventId, sessionId } = await params;

  let seats;
  try {
    seats = await getSessionSeats(sessionId);
  } catch {
    notFound();
  }

  return <SeatSelectionClient eventId={eventId} sessionId={sessionId} seats={seats} />;
}
