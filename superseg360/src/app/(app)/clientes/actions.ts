"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { clientSchema, type ClientInput } from "@/lib/schemas";
import { dbErrorMessage, fail, zodFieldErrors, type ActionResult } from "@/lib/action";
import { lookupCnpj, type CnpjPublicData } from "@/lib/cnpj-lookup";

export async function saveClient(id: string | null, input: ClientInput): Promise<ActionResult<{ id: string }>> {
  const profile = await requireWriter();
  const parsed = clientSchema.safeParse(input);
  if (!parsed.success) return fail("Corrija os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { contacts, units, ...company } = parsed.data;
  const supabase = await createClient();

  const dup = await supabase.from("clients").select("id,razao_social").eq("cnpj", company.cnpj).maybeSingle();
  if (dup.data && dup.data.id !== id) {
    return fail(`Já existe uma empresa com este CNPJ: ${dup.data.razao_social}.`, { cnpj: "CNPJ já cadastrado" });
  }

  let clientId = id;
  if (id) {
    const { error } = await supabase.from("clients").update({ ...company, updated_by: profile.id }).eq("id", id);
    if (error) return fail(dbErrorMessage(error));
  } else {
    const { data, error } = await supabase
      .from("clients")
      .insert({ ...company, created_by: profile.id, updated_by: profile.id })
      .select("id")
      .single();
    if (error || !data) return fail(dbErrorMessage(error));
    clientId = data.id as string;
  }
  const cid = clientId as string;

  const partial = (error: { message: string; code?: string }): ActionResult<{ id: string }> => ({
    ...fail(`Empresa salva, mas houve erro em contatos/unidades: ${dbErrorMessage(error)}`),
    data: { id: cid },
  });

  const keptContacts = contacts.map((c) => ({ ...c, client_id: cid }));
  for (const c of keptContacts) {
    const { id: contactId, ...row } = c;
    const q = contactId
      ? supabase.from("client_contacts").update({ ...row, active: true }).eq("id", contactId).eq("client_id", cid)
      : supabase.from("client_contacts").insert(row);
    const { error } = await q;
    if (error) return partial(error);
  }
  const keepContactIds = keptContacts.map((c) => c.id).filter(Boolean) as string[];
  if (id) {
    const { data: existing } = await supabase.from("client_contacts").select("id").eq("client_id", cid).eq("active", true);
    const toDeactivate = (existing ?? []).map((r) => r.id as string).filter((x) => !keepContactIds.includes(x));
    if (toDeactivate.length) await supabase.from("client_contacts").update({ active: false }).in("id", toDeactivate);
  }

  for (const u of units) {
    const { id: unitId, ...row } = u;
    const q = unitId
      ? supabase.from("client_units").update({ ...row, active: true }).eq("id", unitId).eq("client_id", cid)
      : supabase.from("client_units").insert({ ...row, client_id: cid });
    const { error } = await q;
    if (error) return partial(error);
  }
  const keepUnitIds = units.map((u) => u.id).filter(Boolean) as string[];
  if (id) {
    const { data: existing } = await supabase.from("client_units").select("id").eq("client_id", cid).eq("active", true);
    const toDeactivate = (existing ?? []).map((r) => r.id as string).filter((x) => !keepUnitIds.includes(x));
    if (toDeactivate.length) await supabase.from("client_units").update({ active: false }).in("id", toDeactivate);
  }

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cid}`);
  return { ok: true, data: { id: cid } };
}

export async function setClientActive(id: string, active: boolean): Promise<ActionResult> {
  const profile = await requireWriter();
  const supabase = await createClient();
  const { error } = await supabase.from("clients").update({ active, updated_by: profile.id }).eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

export async function lookupCnpjAction(cnpj: string): Promise<ActionResult<CnpjPublicData>> {
  await requireProfile();
  const result = await lookupCnpj(cnpj);
  if (!result.ok) return fail(result.error);
  const supabase = await createClient();
  const { data: existing } = await supabase.from("clients").select("id,razao_social").eq("cnpj", result.data.cnpj).maybeSingle();
  if (existing) return { ...fail(`Esta empresa já está cadastrada: ${existing.razao_social}.`), data: result.data };
  return { ok: true, data: result.data };
}
