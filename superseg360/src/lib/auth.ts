import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AppRole, Profile } from "@/lib/types";

export const getProfile = cache(async (): Promise<Profile | null> => {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase
    .from("profiles")
    .select("id,email,full_name,role,active,max_discount_percent")
    .eq("id", auth.user.id)
    .maybeSingle();
  return (data as Profile | null) ?? null;
});

export async function requireProfile(): Promise<Profile> {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (!profile.active) redirect("/login?erro=inativo");
  return profile;
}

export async function requireRole(roles: AppRole[]): Promise<Profile> {
  const profile = await requireProfile();
  if (!roles.includes(profile.role)) redirect("/acesso-negado");
  return profile;
}

export const requireWriter = () => requireRole(["admin", "comercial"]);
export const requireAdmin = () => requireRole(["admin"]);

export const canWrite = (p: Pick<Profile, "role">) => p.role === "admin" || p.role === "comercial";
export const isAdmin = (p: Pick<Profile, "role">) => p.role === "admin";

export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return next;
}
