import type { SupabaseClient } from "@supabase/supabase-js";
import type { Service } from "@/lib/types";
import type { ServiceOption } from "@/components/quote-editor";

export async function loadEditorLookups(supabase: SupabaseClient) {
  const [clients, services] = await Promise.all([
    supabase.from("clients").select("id,razao_social,nome_fantasia,cnpj").eq("active", true).order("razao_social").limit(2000),
    supabase.from("services").select("*").eq("active", true).order("code"),
  ]);
  return {
    clients: ((clients.data ?? []) as { id: string; razao_social: string; nome_fantasia: string | null }[]).map((c) => ({
      id: c.id,
      label: c.nome_fantasia ? `${c.razao_social} (${c.nome_fantasia})` : c.razao_social,
    })),
    services: ((services.data ?? []) as Service[]).map<ServiceOption>((s) => ({
      id: s.id, code: s.code, name: s.name, description: s.commercial_description, technical_scope: s.technical_scope,
      inclusions: s.inclusions, exclusions: s.exclusions, specific_clauses: s.specific_clauses, unit_label: s.unit_label,
      suggested_price_cents: Number(s.suggested_price_cents), delivery_days: s.delivery_days,
    })),
  };
}

export async function loadClientOptions(supabase: SupabaseClient, clientId: string) {
  const [units, contacts] = await Promise.all([
    supabase.from("client_units").select("id,name").eq("client_id", clientId).eq("active", true).order("name"),
    supabase.from("client_contacts").select("id,name,email,is_primary").eq("client_id", clientId).eq("active", true).order("name"),
  ]);
  return {
    units: (units.data ?? []) as { id: string; name: string }[],
    contacts: (contacts.data ?? []) as { id: string; name: string; email: string | null; is_primary: boolean }[],
  };
}
