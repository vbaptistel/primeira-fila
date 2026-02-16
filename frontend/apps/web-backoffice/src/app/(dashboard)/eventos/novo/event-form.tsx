"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useState, useTransition } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label, Textarea, Select } from "@primeira-fila/shared";
import { createEventAction } from "../actions";

const eventSchema = z.object({
  name: z.string().min(1, "Nome obrigatorio"),
  slug: z.string().min(1, "Slug obrigatorio").regex(/^[a-z0-9-]+$/, "Slug deve conter apenas letras minusculas, numeros e hifens"),
  description: z.string().optional(),
  timezone: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED"])
});

type EventFormData = z.infer<typeof eventSchema>;

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function EventForm() {
  const [serverError, setServerError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors }
  } = useForm<EventFormData>({
    resolver: zodResolver(eventSchema),
    defaultValues: {
      status: "DRAFT",
      timezone: "America/Sao_Paulo"
    }
  });

  function onSubmit(data: EventFormData) {
    setServerError(null);
    startTransition(async () => {
      try {
        await createEventAction(data);
      } catch (err) {
        setServerError(err instanceof Error ? err.message : "Erro ao criar evento.");
      }
    });
  }

  return (
    <Card className="max-w-2xl">
      <CardHeader>
        <CardTitle>Novo Evento</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              placeholder="Nome do evento"
              {...register("name", {
                onChange: (e) => setValue("slug", generateSlug(e.target.value))
              })}
            />
            {errors.name && <p className="text-sm text-red-500">{errors.name.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="slug">Slug</Label>
            <Input id="slug" placeholder="slug-do-evento" {...register("slug")} />
            {errors.slug && <p className="text-sm text-red-500">{errors.slug.message}</p>}
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="description">Descricao</Label>
            <Textarea id="description" placeholder="Descricao do evento" {...register("description")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="timezone">Fuso Horario</Label>
            <Input id="timezone" placeholder="America/Sao_Paulo" {...register("timezone")} />
          </div>

          <div className="flex flex-col gap-1">
            <Label htmlFor="status">Status</Label>
            <Select id="status" {...register("status")}>
              <option value="DRAFT">Rascunho</option>
              <option value="PUBLISHED">Publicado</option>
            </Select>
          </div>

          {serverError && <p className="text-sm text-red-500">{serverError}</p>}

          <div className="flex gap-3 pt-2">
            <Button type="submit" variant="primary" disabled={isPending}>
              {isPending ? "Criando..." : "Criar Evento"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
