import type { Metadata } from "next";
import { getTenant } from "@/lib/get-tenant";
import { TenantProvider } from "@/context/tenant-context";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();

  return {
    title: `${tenant.name} | Ingressos`,
    description: `Compre ingressos em ${tenant.name}`,
    icons: tenant.faviconUrl ? { icon: tenant.faviconUrl } : undefined
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const tenant = await getTenant();

  return (
    <html lang="pt-BR">
      <body className="antialiased flex flex-col min-h-screen">
        <TenantProvider tenant={tenant}>
          <Header />
          <main className="flex-1">
            {children}
          </main>
          <Footer />
        </TenantProvider>
      </body>
    </html>
  );
}
