"use client";

import {
  createTenantUser,
  listTenantUsers,
  type CreateTenantUserPayload,
  type TenantUser,
} from "@/lib/api";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@primeira-fila/shared";
import { useState } from "react";

type Props = {
  tenantId: string;
  accessToken: string;
  initialUsers: TenantUser[];
  initialError: string | null;
};

const ROLES: { value: CreateTenantUserPayload["role"]; label: string; }[] = [
  { value: "organizer_admin", label: "Admin do organizador" },
  { value: "operator", label: "Operador" },
];

export function UsuariosClient({
  tenantId,
  accessToken,
  initialUsers,
  initialError,
}: Props) {
  const [users, setUsers] = useState<TenantUser[]>(initialUsers);
  const [error] = useState<string | null>(initialError);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateTenantUserPayload>({
    email: "",
    displayName: "",
    password: "",
    role: "operator",
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSubmitting(true);
    try {
      await createTenantUser(tenantId, form, { token: accessToken });
      const updated = await listTenantUsers(tenantId, { token: accessToken });
      setUsers(updated);
      setOpen(false);
      setForm({ email: "", displayName: "", password: "", role: "operator" });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Erro ao criar usuário.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Usuários do tenant</CardTitle>
          <CardDescription>
            Liste e adicione usuários com acesso a este organizador.
          </CardDescription>
        </div>
        <Button variant="primary" size="md" onClick={() => setOpen(true)}>
          Adicionar usuário
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogHeader>
            <DialogTitle>Novo usuário</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="email">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) =>
                  setForm((p) => ({ ...p, email: e.target.value }))
                }
                required
                placeholder="nome@exemplo.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="displayName">Nome de exibição (opcional)</Label>
              <Input
                id="displayName"
                type="text"
                value={form.displayName ?? ""}
                onChange={(e) =>
                  setForm((p) => ({ ...p, displayName: e.target.value }))
                }
                placeholder="Ex.: Maria Silva"
                maxLength={160}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Senha</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={(e) =>
                  setForm((p) => ({ ...p, password: e.target.value }))
                }
                required
                minLength={8}
                placeholder="Mínimo 8 caracteres"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Papel</Label>
              <select
                id="role"
                value={form.role}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    role: e.target.value as CreateTenantUserPayload["role"],
                  }))
                }
                className="flex h-9 w-full rounded-md border border-[var(--pf-color-border)] bg-transparent px-3 py-1 text-sm shadow-sm"
              >
                {ROLES.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            {formError && (
              <p className="text-sm text-red-600">{formError}</p>
            )}
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Criando…" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </Dialog>
      </CardHeader>
      <CardContent>
        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}
        {users.length === 0 && !error ? (
          <p className="text-[var(--pf-color-muted-text)]">
            Nenhum usuário ainda. Adicione o primeiro acima.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-[var(--pf-color-border)]">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--pf-color-border)] bg-[var(--pf-color-surface)]">
                  <th className="p-3 font-medium">Nome</th>
                  <th className="p-3 font-medium">E-mail</th>
                  <th className="p-3 font-medium">Papel</th>
                  <th className="p-3 font-medium">Criado em</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr
                    key={u.id}
                    className="border-b border-[var(--pf-color-border)]"
                  >
                    <td className="p-3">
                      {u.displayName?.trim() || u.email}
                    </td>
                    <td className="p-3 text-[var(--pf-color-muted-text)]">
                      {u.email}
                    </td>
                    <td className="p-3">{u.role}</td>
                    <td className="p-3 text-[var(--pf-color-muted-text)]">
                      {new Date(u.createdAt).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
