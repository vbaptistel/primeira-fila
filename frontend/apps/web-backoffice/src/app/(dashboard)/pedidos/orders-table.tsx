"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@primeira-fila/shared";
import { formatCurrency, formatDateTime, orderStatusLabels } from "@/lib/format";
import type { AdminEvent, AdminOrder, OrderStatus } from "@/types/api";

const statusVariant: Record<OrderStatus, "primary" | "default" | "danger" | "accent"> = {
  PENDING_PAYMENT: "accent",
  PAID: "primary",
  CANCELLED: "danger",
  EXPIRED: "default"
};

type Props = {
  orders: AdminOrder[];
  total: number;
  events: AdminEvent[];
};

export function OrdersTable({ orders, total, events }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const currentStatus = searchParams.get("status") ?? "";
  const currentEventId = searchParams.get("eventId") ?? "";

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("offset");
    router.push(`/pedidos?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex gap-4 items-end">
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--pf-color-muted-text)]">Status</label>
          <Select
            value={currentStatus}
            onValueChange={(val) => updateFilter("status", val)}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos</SelectItem>
              <SelectItem value="PENDING_PAYMENT">Aguardando Pagamento</SelectItem>
              <SelectItem value="PAID">Pago</SelectItem>
              <SelectItem value="CANCELLED">Cancelado</SelectItem>
              <SelectItem value="EXPIRED">Expirado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-[var(--pf-color-muted-text)]">Evento</label>
          <Select
            value={currentEventId}
            onValueChange={(val) => updateFilter("eventId", val)}
          >
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Todos os eventos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Todos os eventos</SelectItem>
              {events.map((event) => (
                <SelectItem key={event.id} value={event.id}>{event.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <p className="text-sm text-[var(--pf-color-muted-text)]">{total} pedido(s) encontrado(s)</p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ID</TableHead>
            <TableHead>Comprador</TableHead>
            <TableHead>Sessao</TableHead>
            <TableHead>Valor</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Data</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-[var(--pf-color-muted-text)] py-8">
                Nenhum pedido encontrado.
              </TableCell>
            </TableRow>
          ) : (
            orders.map((order) => (
              <TableRow key={order.id}>
                <TableCell className="font-mono text-xs">{order.id.slice(0, 8)}...</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium text-sm">{order.buyerName}</p>
                    <p className="text-xs text-[var(--pf-color-muted-text)]">{order.buyerEmail}</p>
                  </div>
                </TableCell>
                <TableCell className="text-sm">{order.session.name}</TableCell>
                <TableCell className="font-medium text-sm">
                  {formatCurrency(order.totalAmountCents)}
                </TableCell>
                <TableCell>
                  <Badge variant={statusVariant[order.status]}>
                    {orderStatusLabels[order.status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-[var(--pf-color-muted-text)]">
                  {formatDateTime(order.createdAt)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
