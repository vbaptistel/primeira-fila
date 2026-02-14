import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Primeira Fila | Web Backoffice",
  description: "Aplicacao operacional do organizador",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}
