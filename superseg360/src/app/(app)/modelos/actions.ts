"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { templateSchema } from "@/lib/schemas";
import { TEMPLATE_KEYS } from "@/lib/templates";
import { dbErrorMessage, fail, type ActionResult } from "@/lib/action";

export async function createTemplateDraft(key: string, title: string, body: string): Promise<ActionResult> {
  const profile = await requireAdmin();
  if (!(TEMPLATE_KEYS as readonly string[]).includes(key)) return fail("Modelo desconhecido.");
  const parsed = templateSchema.safeParse({ title, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const supabase = await createClient();
  const { data: rows } = await supabase.from("document_templates").select("version,kind,status").eq("key", key);
  if (!rows?.length) return fail("Modelo não encontrado.");
  if (rows.some((r) => r.status === "draft")) return fail("Já existe um rascunho para este modelo. Edite-o ou aprove-o.");
  const version = Math.max(...rows.map((r) => r.version as number)) + 1;
  const { error } = await supabase.from("document_templates").insert({
    key, kind: rows[0]!.kind, title: parsed.data.title, body: parsed.data.body, version, status: "draft", created_by: profile.id,
  });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/modelos");
  return { ok: true };
}

export async function updateTemplateDraft(id: string, title: string, body: string): Promise<ActionResult> {
  await requireAdmin();
  const parsed = templateSchema.safeParse({ title, body });
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Dados inválidos.");
  const supabase = await createClient();
  const { error } = await supabase.from("document_templates").update(parsed.data).eq("id", id).eq("status", "draft");
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/modelos");
  return { ok: true };
}

export async function approveTemplate(id: string): Promise<ActionResult> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("document_templates").update({ status: "approved" }).eq("id", id).eq("status", "draft");
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/modelos");
  return { ok: true };
}
