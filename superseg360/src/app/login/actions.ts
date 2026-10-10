"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/auth";

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const next = safeNext(String(formData.get("next") ?? ""));
  if (!email || !password) redirect(`/login?erro=campos&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect(`/login?erro=credenciais&next=${encodeURIComponent(next)}`);

  const { data: auth } = await supabase.auth.getUser();
  const { data: profile } = await supabase.from("profiles").select("active").eq("id", auth.user?.id ?? "").maybeSingle();
  if (!profile?.active) {
    await supabase.auth.signOut();
    redirect("/login?erro=inativo");
  }
  redirect(next);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
