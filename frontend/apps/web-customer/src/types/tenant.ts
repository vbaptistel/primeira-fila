export type ColorScheme = "light" | "dark" | "system";

export type TenantBranding = {
  id: string;
  name: string;
  slug: string;
  subdomain: string;
  logoUrl: string | null;
  faviconUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  colorScheme: ColorScheme;
  footerText: string | null;
  termsUrl: string | null;
  privacyUrl: string | null;
  socialLinks: Record<string, string> | null;
};
