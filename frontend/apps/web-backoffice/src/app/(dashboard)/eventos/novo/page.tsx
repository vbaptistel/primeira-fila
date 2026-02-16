import Link from "next/link";
import { Button } from "@primeira-fila/shared";
import { EventForm } from "./event-form";

export default function NovoEventoPage() {
  return (
    <div>
      <div className="mb-6">
        <Link href="/eventos">
          <Button variant="ghost" size="sm">Voltar</Button>
        </Link>
      </div>
      <EventForm />
    </div>
  );
}
