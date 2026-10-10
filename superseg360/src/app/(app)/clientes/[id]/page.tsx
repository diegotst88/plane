import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { ClientForm, type ClientFormValues } from "@/components/client-form";
import { AuditHistory } from "@/components/audit-history";
import { formatCep, formatCnpj } from "@/lib/cnpj";
import { BackLink, PageHeader, StatusBadge } from "@/components/ui";
import { displayStatus, formatDateBR } from "@/lib/quote-status";
import { formatBRL } from "@/lib/money";
import type { AuditEntry, Client, ClientContact, ClientUnit, Quote } from "@/lib/types";

export default async function ClientPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();

  const { data: client } = await supabase.from("clients").select("*").eq("id", id).maybeSingle();
  if (!client) notFound();
  const c = client as Client;

  const [contacts, units, quotes, audit] = await Promise.all([
    supabase.from("client_contacts").select("*").eq("client_id", id).eq("active", true).order("created_at"),
    supabase.from("client_units").select("*").eq("client_id", id).eq("active", true).order("created_at"),
    supabase.from("quotes").select("id,number,version,status,validity_date,total_cents,subject").eq("client_id", id).eq("is_current", true).order("created_at", { ascending: false }),
    supabase.from("audit_log").select("id,at,user_email,table_name,action,changed_fields").eq("context_id", id).order("at", { ascending: false }).limit(50),
  ]);

  const s = (v: string | null) => v ?? "";
  const initial: ClientFormValues = {
    id: c.id,
    active: c.active,
    razao_social: c.razao_social,
    nome_fantasia: s(c.nome_fantasia),
    cnpj: formatCnpj(c.cnpj),
    inscricao_estadual: s(c.inscricao_estadual),
    ie_isento: c.ie_isento,
    cep: formatCep(c.cep),
    logradouro: s(c.logradouro),
    numero: s(c.numero),
    complemento: s(c.complemento),
    bairro: s(c.bairro),
    cidade: s(c.cidade),
    uf: s(c.uf),
    billing_cnpj: c.billing_cnpj ? formatCnpj(c.billing_cnpj) : "",
    billing_name: s(c.billing_name),
    notes: s(c.notes),
    contacts: ((contacts.data ?? []) as ClientContact[]).map((x) => ({
      id: x.id, name: x.name, role_title: s(x.role_title), email: s(x.email), phone: s(x.phone), is_primary: x.is_primary,
    })),
    units: ((units.data ?? []) as ClientUnit[]).map((x) => ({
      id: x.id, name: x.name, cnpj: x.cnpj ? formatCnpj(x.cnpj) : "", cep: formatCep(x.cep), logradouro: s(x.logradouro),
      numero: s(x.numero), complemento: s(x.complemento), bairro: s(x.bairro), cidade: s(x.cidade), uf: s(x.uf),
    })),
  };

  const quoteRows = (quotes.data ?? []) as Pick<Quote, "id" | "number" | "version" | "status" | "validity_date" | "total_cents" | "subject">[];

  return (
    <>
      <BackLink href="/clientes">Clientes</BackLink>
      <PageHeader
        title={c.razao_social}
        subtitle={`CNPJ ${formatCnpj(c.cnpj)}${c.active ? "" : " · INATIVA"}`}
        actions={canWrite(profile) && c.active && <Link href={`/orcamentos/novo?cliente=${c.id}`} className="btn-accent">Novo orçamento</Link>}
      />
      <ClientForm key={JSON.stringify(initial)} initial={initial} readOnly={!canWrite(profile)} />

      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Propostas deste cliente</h2>
        {quoteRows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma proposta ainda.</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {quoteRows.map((q) => (
                <tr key={q.id}>
                  <td className="td"><Link className="font-medium text-brand-700 hover:underline" href={`/orcamentos/${q.id}`}>#{q.number} v{q.version}</Link></td>
                  <td className="td">{q.subject}</td>
                  <td className="td"><StatusBadge status={displayStatus(q.status, q.validity_date)} /></td>
                  <td className="td text-slate-500">até {formatDateBR(q.validity_date)}</td>
                  <td className="td text-right font-medium">{formatBRL(q.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Histórico de alterações</h2>
        <AuditHistory entries={(audit.data ?? []) as AuditEntry[]} />
      </section>
    </>
  );
}
