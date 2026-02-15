import { OrderDetailClient } from "./order-detail-client";

type PageProps = {
  params: Promise<{ orderId: string }>;
  searchParams: Promise<{ token?: string; email?: string }>;
};

export default async function OrderDetailPage({ params, searchParams }: PageProps) {
  const { orderId } = await params;
  const { token, email } = await searchParams;

  if (!token || !email) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-[var(--pf-color-text)]">Acesso invalido</h1>
        <p className="mt-2 text-[var(--pf-color-muted-text)]">
          O link de acesso e invalido ou incompleto. Solicite um novo link na pagina de pedidos.
        </p>
      </div>
    );
  }

  return <OrderDetailClient orderId={orderId} token={token} email={email} />;
}
