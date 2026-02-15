"use client";

import { createContext, useContext, useEffect, type ReactNode } from "react";
import type { TenantBranding } from "@/types/tenant";
import { applyTenantBranding } from "@/lib/tenant";

type TenantContextType = {
  tenant: TenantBranding;
};

const TenantContext = createContext<TenantContextType | null>(null);

type TenantProviderProps = {
  tenant: TenantBranding;
  children: ReactNode;
};

export function TenantProvider({ tenant, children }: TenantProviderProps) {
  useEffect(() => {
    applyTenantBranding(tenant);

    if (tenant.colorScheme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTenantBranding(tenant);
    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, [tenant]);

  return (
    <TenantContext.Provider value={{ tenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant(): TenantBranding {
  const context = useContext(TenantContext);
  if (!context) {
    throw new Error("useTenant deve ser usado dentro de um TenantProvider.");
  }
  return context.tenant;
}
