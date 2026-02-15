import { CheckoutClient } from "./checkout-client";

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ eventId?: string; sessionId?: string }>;
};

export default async function CheckoutPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { eventId, sessionId } = await searchParams;

  return (
    <CheckoutClient
      holdId={orderId}
      eventId={eventId ?? ""}
      sessionId={sessionId ?? ""}
    />
  );
}
