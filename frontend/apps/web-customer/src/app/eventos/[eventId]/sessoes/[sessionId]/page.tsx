import { SeatSelectionClient } from "./seat-selection-client";

type PageProps = {
  params: Promise<{ eventId: string; sessionId: string }>;
};

export default async function SeatSelectionPage({ params }: PageProps) {
  const { eventId, sessionId } = await params;

  return <SeatSelectionClient eventId={eventId} sessionId={sessionId} />;
}
