import { notFound } from "next/navigation";
import { requireProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ServiceForm, toFormValues } from "@/components/service-form";
import { AuditHistory } from "@/components/audit-history";
import { BackLink, PageHeader } from "@/components/ui";
import type { AuditEntry, Service } from "@/lib/types";

export default async function ServicePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("services").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const service = data as Service;
  const { data: audit } = await supabase
    .from("audit_log")
    .select("id,at,user_email,table_name,action,changed_fields")
    .eq("context_id", id)
    .order("at", { ascending: false })
    .limit(30);
  const initial = toFormValues(service);
  return (
    <>
      <BackLink href="/servicos">Serviços</BackLink>
      <PageHeader title={`${service.code} · ${service.name}`} />
      <ServiceForm key={JSON.stringify(initial)} initial={initial} readOnly={!isAdmin(profile)} />
      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Histórico de alterações</h2>
        <AuditHistory entries={(audit ?? []) as AuditEntry[]} />
      </section>
    </>
  );
}
