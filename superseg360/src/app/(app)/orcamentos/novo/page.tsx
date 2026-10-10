import { requireWriter } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuoteEditor, type EditorValues } from "@/components/quote-editor";
import { BackLink, EmptyState, PageHeader } from "@/components/ui";
import { loadClientOptions, loadEditorLookups } from "@/lib/quote-editor-data";
import { todayISO } from "@/lib/quote-status";
import Link from "next/link";

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default async function NewQuotePage({ searchParams }: { searchParams: Promise<{ cliente?: string }> }) {
  const profile = await requireWriter();
  const { cliente } = await searchParams;
  const supabase = await createClient();
  const { clients, services } = await loadEditorLookups(supabase);
  const preselected = clients.find((c) => c.id === cliente)?.id ?? "";
  const opts = preselected ? await loadClientOptions(supabase, preselected) : { units: [], contacts: [] };

  const initial: EditorValues = {
    client_id: preselected,
    unit_id: "",
    contact_id: opts.contacts.find((c) => c.is_primary)?.id ?? "",
    subject: "",
    validity_date: addDays(todayISO(), 15),
    delivery_days: "",
    payment_terms: "",
    internal_notes: "",
    items: [],
  };

  return (
    <>
      <BackLink href="/orcamentos">Orçamentos</BackLink>
      <PageHeader title="Novo orçamento" />
      {clients.length === 0 ? (
        <EmptyState>
          Cadastre ao menos uma empresa em <Link href="/clientes/novo" className="text-brand-600 underline">Clientes</Link> antes de criar um orçamento.
        </EmptyState>
      ) : (
        <QuoteEditor
          quoteId={null}
          initial={initial}
          clients={clients}
          services={services}
          maxDiscount={profile.role === "admin" ? 100 : Number(profile.max_discount_percent)}
          initialUnits={opts.units}
          initialContacts={opts.contacts}
        />
      )}
    </>
  );
}
