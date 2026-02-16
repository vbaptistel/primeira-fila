import { requireSession } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const session = await requireSession();

  return (
    <div className="flex min-h-screen">
      <Sidebar email={session.email} />
      <main className="flex-1 p-6 overflow-y-auto">{children}</main>
    </div>
  );
}
