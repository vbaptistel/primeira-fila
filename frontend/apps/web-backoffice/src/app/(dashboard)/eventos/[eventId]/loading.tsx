import { Skeleton } from "@primeira-fila/shared";

export default function EventDetailLoading() {
  return (
    <div>
      <Skeleton className="h-8 w-40 mb-6" />
      <Skeleton className="h-48 w-full mb-6" />
      <Skeleton className="h-8 w-48 mb-4" />
      <Skeleton className="h-32 w-full mb-4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}
