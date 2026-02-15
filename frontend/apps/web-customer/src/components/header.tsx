"use client";

import Link from "next/link";
import Image from "next/image";
import { useTenant } from "@/context/tenant-context";

export function Header() {
  const tenant = useTenant();

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          {tenant.logoUrl ? (
            <Image
              src={tenant.logoUrl}
              alt={tenant.name}
              width={140}
              height={40}
              className="h-8 w-auto object-contain"
              priority
            />
          ) : (
            <span className="text-lg font-bold" style={{ color: "var(--pf-color-primary)" }}>
              {tenant.name}
            </span>
          )}
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/"
            className="text-sm font-medium text-[var(--pf-color-text)] hover:text-[var(--pf-color-primary)] transition-colors"
          >
            Eventos
          </Link>
          <Link
            href="/pedidos"
            className="text-sm font-medium text-[var(--pf-color-muted-text)] hover:text-[var(--pf-color-primary)] transition-colors"
          >
            Meus ingressos
          </Link>
        </nav>
      </div>
    </header>
  );
}
