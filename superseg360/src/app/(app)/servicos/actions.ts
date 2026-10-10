"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { serviceSchema, type ServiceInput } from "@/lib/schemas";
import { dbErrorMessage, fail, zodFieldErrors, type ActionResult } from "@/lib/action";

export async function saveService(id: string | null, input: ServiceInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireAdmin();
  const parsed = serviceSchema.safeParse(input);
  if (!parsed.success) return fail("Corrija os campos destacados.", zodFieldErrors(parsed.error.issues));
  const supabase = await createClient();
  if (id) {
    const { error } = await supabase.from("services").update(parsed.data).eq("id", id);
    if (error) return fail(dbErrorMessage(error));
    revalidatePath("/servicos");
    return { ok: true, data: { id } };
  }
  const { data, error } = await supabase
    .from("services")
    .insert({ ...parsed.data, created_by: profile.id })
    .select("id")
    .single();
  if (error || !data) return fail(dbErrorMessage(error));
  revalidatePath("/servicos");
  return { ok: true, data: { id: data.id as string } };
}
