import { Suspense } from "react";
import { requireSession } from "@/lib/auth";
import { listOrders, listEvents } from "@/lib/api";
import { OrdersTable } from "./orders-table";
import PedidosLoading from "./loading";

type Props = {
  searchParams: Promise<{ status?: string; eventId?: string; sessionId?: string; offset?: string }>;
};

async function OrdersContent({ searchParams }: Props) {
  const params = await searchParams;
  const session = await requireSession();

  const [ordersResponse, events] = await Promise.all([
    listOrders(
      session.tenantId,
      {
        status: params.status,
        eventId: params.eventId,
        sessionId: params.sessionId,
        limit: 50,
        offset: params.offset ? parseInt(params.offset, 10) : 0
      },
      { token: session.accessToken }
    ),
    listEvents(session.tenantId, { token: session.accessToken })
  ]);

  return (
    <OrdersTable
      orders={ordersResponse.data}
      total={ordersResponse.total}
      events={events}
    />
  );
}

export default async function PedidosPage(props: Props) {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Pedidos</h1>
      <Suspense fallback={<PedidosLoading />}>
        <OrdersContent searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}
