"use server";

import { revalidatePath } from "next/cache";
import { requireProfile, requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { quoteSchema, type QuoteInput } from "@/lib/schemas";
import { dbErrorMessage, fail, zodFieldErrors, type ActionResult } from "@/lib/action";
import { loadTemplateRows } from "@/lib/proposal-loader";
import { selectTemplates, snapshotOf } from "@/lib/template-select";
import { todayISO } from "@/lib/quote-status";
import { calcQuote } from "@/lib/quote-calc";

export async function saveQuote(id: string | null, input: QuoteInput): Promise<ActionResult<{ id: string }>> {
  await requireWriter();
  const parsed = quoteSchema.safeParse(input);
  if (!parsed.success) return fail("Corrija os campos destacados.", zodFieldErrors(parsed.error.issues));
  const { items, ...header } = parsed.data;
  if (header.validity_date < todayISO()) {
    return fail("A validade não pode estar no passado.", { validity_date: "Data já vencida" });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("save_quote", { p_id: id, p_header: header, p_items: items });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data as string } };
}

export async function getClientOptions(clientId: string) {
  await requireProfile();
  const supabase = await createClient();
  const [units, contacts] = await Promise.all([
    supabase.from("client_units").select("id,name").eq("client_id", clientId).eq("active", true).order("name"),
    supabase.from("client_contacts").select("id,name,email,is_primary").eq("client_id", clientId).eq("active", true).order("name"),
  ]);
  return {
    units: (units.data ?? []) as { id: string; name: string }[],
    contacts: (contacts.data ?? []) as { id: string; name: string; email: string | null; is_primary: boolean }[],
  };
}

export async function sendQuote(id: string): Promise<ActionResult> {
  await requireWriter();
  const supabase = await createClient();
  const { data: quote } = await supabase
    .from("quotes")
    .select("id,status,validity_date,total_cents,is_current")
    .eq("id", id)
    .maybeSingle();
  if (!quote) return fail("Orçamento não encontrado.");
  if (quote.status !== "elaboracao") return fail("Este orçamento já foi enviado.");
  if (quote.validity_date < todayISO()) return fail("A validade já expirou. Atualize a data antes de enviar.");

  const { data: items } = await supabase.from("quote_items").select("quantity,unit_price_cents,discount_percent,total_cents").eq("quote_id", id);
  const recomputed = calcQuote(
    (items ?? []).map((i) => ({ quantity: Number(i.quantity), unitPriceCents: Number(i.unit_price_cents), discountPercent: Number(i.discount_percent) })),
  );
  if (recomputed.totalCents !== Number(quote.total_cents) || recomputed.totalCents <= 0) {
    return fail("Divergência de cálculo detectada ou orçamento sem valor. Reabra e salve o orçamento novamente.");
  }

  const selection = selectTemplates(await loadTemplateRows(supabase), null);
  if (selection.pendingKeys.length > 0) {
    return fail(
      "Existem modelos de texto da proposta (institucionais/cláusulas) ainda não aprovados por um administrador. Aprove-os em “Modelos de texto” antes de enviar a um cliente.",
    );
  }
  const { error } = await supabase
    .from("quotes")
    .update({ status: "enviada", template_snapshot: snapshotOf(selection) })
    .eq("id", id);
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function decideQuote(id: string, decision: "aprovada" | "recusada", note: string): Promise<ActionResult> {
  await requireWriter();
  if (decision !== "aprovada" && decision !== "recusada") return fail("Decisão inválida.");
  const supabase = await createClient();
  const { error } = await supabase
    .from("quotes")
    .update({ status: decision, decision_note: note.trim().slice(0, 2000) || null })
    .eq("id", id)
    .eq("status", "enviada");
  if (error) return fail(dbErrorMessage(error));
  revalidatePath(`/orcamentos/${id}`);
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  return { ok: true };
}

export async function createNewVersion(id: string): Promise<ActionResult<{ id: string }>> {
  await requireWriter();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("quote_new_version", { p_quote_id: id });
  if (error) return fail(dbErrorMessage(error));
  revalidatePath("/orcamentos");
  revalidatePath("/dashboard");
  return { ok: true, data: { id: data as string } };
}
