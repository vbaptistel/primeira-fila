import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@primeira-fila/shared";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#d7f7f0_0%,#f4f8f7_40%,#f4f8f7_100%)] p-6 md:p-12">
      <main className="mx-auto w-full max-w-5xl">
        <Card>
          <CardHeader>
            <CardTitle>Primeira Fila - Web Customer</CardTitle>
            <CardDescription>
              Base inicial da aplicacao de compra de ingressos.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button variant="primary" size="md">Ver eventos</Button>
            <Button variant="secondary" size="md">Minhas compras</Button>
            <Button variant="ghost" size="md">Entrar</Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
