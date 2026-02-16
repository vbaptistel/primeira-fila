"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTransition } from "react";
import { Button } from "@primeira-fila/shared";
import { logoutAction } from "@/app/login/actions";

const navItems = [
  { href: "/eventos", label: "Eventos" },
  { href: "/pedidos", label: "Pedidos" }
];

type SidebarProps = {
  email: string;
};

export function Sidebar({ email }: SidebarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function handleLogout() {
    startTransition(() => logoutAction());
  }

  return (
    <aside className="flex flex-col w-64 min-h-screen border-r border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
      <div className="p-5 border-b border-[var(--pf-color-border)]">
        <h1 className="text-lg font-bold text-[var(--pf-color-text)]">Primeira Fila</h1>
        <p className="text-xs text-[var(--pf-color-muted-text)] mt-1">Backoffice</p>
      </div>

      <nav className="flex-1 p-3 flex flex-col gap-1">
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[var(--pf-color-primary)] text-[var(--pf-color-primary-text)]"
                  : "text-[var(--pf-color-text)] hover:bg-[var(--pf-color-border)]"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-[var(--pf-color-border)]">
        <p className="text-xs text-[var(--pf-color-muted-text)] truncate mb-2">{email}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleLogout}
          disabled={isPending}
          className="w-full"
        >
          {isPending ? "Saindo..." : "Sair"}
        </Button>
      </div>
    </aside>
  );
}
