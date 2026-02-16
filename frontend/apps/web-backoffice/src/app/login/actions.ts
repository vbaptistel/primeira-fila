"use server";

import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type LoginResult = { error: string } | { success: true };

export async function loginAction(data: {
  email: string;
  password: string;
}): Promise<LoginResult> {
  const supabase = await createSupabaseServerClient();

  const { error } = await supabase.auth.signInWithPassword({
    email: data.email,
    password: data.password
  });

  if (error) {
    return { error: error.message };
  }

  // Não usar redirect() aqui: a resposta de redirect (303) pode ser enviada
  // antes dos cookies de sessão serem serializados, então o middleware em "/"
  // não vê a sessão e manda de volta para /login. Retornar sucesso e
  // redirecionar no cliente garante que os Set-Cookie vão na resposta.
  return { success: true };
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}
