"use client";

import Link from "next/link";
import { useTenant } from "@/context/tenant-context";

export function Footer() {
  const tenant = useTenant();

  return (
    <footer className="border-t border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col items-center gap-4 text-center">
          {tenant.footerText && (
            <p className="text-sm text-[var(--pf-color-muted-text)]">
              {tenant.footerText}
            </p>
          )}

          <div className="flex items-center gap-4 text-xs text-[var(--pf-color-muted-text)]">
            {tenant.termsUrl && (
              <Link
                href={tenant.termsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--pf-color-primary)] transition-colors underline"
              >
                Termos de uso
              </Link>
            )}
            {tenant.termsUrl && tenant.privacyUrl && (
              <span className="text-[var(--pf-color-border)]">|</span>
            )}
            {tenant.privacyUrl && (
              <Link
                href={tenant.privacyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--pf-color-primary)] transition-colors underline"
              >
                Politica de privacidade
              </Link>
            )}
          </div>

          <p className="text-xs text-[var(--pf-color-muted-text)] opacity-60">
            Powered by Primeira Fila
          </p>
        </div>
      </div>
    </footer>
  );
}
