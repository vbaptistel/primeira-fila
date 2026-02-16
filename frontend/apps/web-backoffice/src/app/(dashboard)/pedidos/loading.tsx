import { Skeleton } from "@primeira-fila/shared";

export default function PedidosLoading() {
  return (
    <div>
      <div className="flex gap-4 mb-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-10 w-64" />
      </div>
      <Skeleton className="h-4 w-32 mb-4" />
      <div className="flex flex-col gap-0">
        <Skeleton className="h-12 w-full" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full mt-1" />
        ))}
      </div>
    </div>
  );
}
