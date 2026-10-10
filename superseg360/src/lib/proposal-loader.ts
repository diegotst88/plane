import type { SupabaseClient } from "@supabase/supabase-js";
import { company } from "@/lib/env";
import { formatAddress } from "@/lib/address";
import { buildTemplateVars, renderTemplate, type TemplateKey } from "@/lib/templates";
import { selectTemplates, type TemplateRow, type TemplateSelection } from "@/lib/template-select";
import { todayISO } from "@/lib/quote-status";
import type { ProposalData } from "@/lib/pdf/types";
import type { Client, ClientContact, ClientUnit, Quote, QuoteItem } from "@/lib/types";

export async function loadTemplateRows(supabase: SupabaseClient): Promise<TemplateRow[]> {
  const { data } = await supabase.from("document_templates").select("id,key,body,version,status");
  return (data ?? []) as TemplateRow[];
}

export interface LoadedProposal {
  data: ProposalData;
  quote: Quote;
  selection: TemplateSelection;
}

export async function loadProposal(supabase: SupabaseClient, quoteId: string): Promise<LoadedProposal | null> {
  const { data: q } = await supabase.from("quotes").select("*").eq("id", quoteId).maybeSingle();
  if (!q) return null;
  const quote = q as Quote;

  const [clientRes, itemsRes, unitRes, contactRes, templateRows] = await Promise.all([
    supabase.from("clients").select("*").eq("id", quote.client_id).single(),
    supabase.from("quote_items").select("*").eq("quote_id", quote.id).order("position"),
    quote.unit_id ? supabase.from("client_units").select("*").eq("id", quote.unit_id).maybeSingle() : Promise.resolve({ data: null }),
    quote.contact_id ? supabase.from("client_contacts").select("*").eq("id", quote.contact_id).maybeSingle() : Promise.resolve({ data: null }),
    loadTemplateRows(supabase),
  ]);
  if (!clientRes.data) return null;
  const client = clientRes.data as Client;
  const items = (itemsRes.data ?? []) as QuoteItem[];
  const unit = unitRes.data as ClientUnit | null;
  const contact = contactRes.data as ClientContact | null;

  const selection = selectTemplates(templateRows, quote.template_snapshot);
  const vars = buildTemplateVars({
    number: quote.number,
    version: quote.version,
    validity_date: quote.validity_date,
    delivery_days: quote.delivery_days,
    payment_terms: quote.payment_terms,
    total_cents: Number(quote.total_cents),
    client,
    unit,
    items,
  });
  const text = (key: TemplateKey) => renderTemplate(selection.byKey[key]?.body ?? "", vars);

  const data: ProposalData = {
    number: quote.number,
    version: quote.version,
    issuedAt: quote.sent_at ? quote.sent_at.slice(0, 10) : todayISO(),
    validityDate: quote.validity_date,
    deliveryDays: quote.delivery_days,
    subject: quote.subject,
    paymentTerms: quote.payment_terms,
    subtotalCents: Number(quote.subtotal_cents),
    discountCents: Number(quote.discount_cents),
    totalCents: Number(quote.total_cents),
    client: {
      razao_social: client.razao_social,
      nome_fantasia: client.nome_fantasia,
      cnpj: client.cnpj,
      inscricao_estadual: client.inscricao_estadual,
      ie_isento: client.ie_isento,
      address: formatAddress(client),
      billing_cnpj: client.billing_cnpj,
      billing_name: client.billing_name,
    },
    unit: unit ? { name: unit.name, address: formatAddress(unit) } : null,
    contact: contact
      ? { name: contact.name, role_title: contact.role_title, email: contact.email, phone: contact.phone }
      : null,
    items: items.map((i) => ({
      code: i.code,
      name: i.name,
      description: i.description,
      technical_scope: i.technical_scope,
      inclusions: i.inclusions,
      exclusions: i.exclusions,
      specific_clauses: i.specific_clauses,
      unit_label: i.unit_label,
      quantity: Number(i.quantity),
      unit_price_cents: Number(i.unit_price_cents),
      discount_percent: Number(i.discount_percent),
      total_cents: Number(i.total_cents),
    })),
    texts: {
      apresentacao: text("apresentacao_superseg"),
      objeto: text("objeto_proposta"),
      condicoes_pagamento: text("condicoes_pagamento"),
      clausulas: text("clausulas_contratuais"),
      aceite: text("formas_aceite"),
    },
    draft: selection.pendingKeys.length > 0,
    company: {
      name: company.name(),
      cnpj: company.cnpj(),
      phone: company.phone(),
      email: company.email(),
      site: company.site(),
    },
    responsible: "Departamento Comercial",
  };
  return { data, quote, selection };
}
