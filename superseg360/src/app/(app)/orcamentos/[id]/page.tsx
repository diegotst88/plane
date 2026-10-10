import Link from "next/link";
import { notFound } from "next/navigation";
import { requireProfile, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { QuoteEditor, type EditorValues } from "@/components/quote-editor";
import { QuoteActions } from "@/components/quote-actions";
import { AuditHistory } from "@/components/audit-history";
import { BackLink, Notice, PageHeader, StatusBadge } from "@/components/ui";
import { loadClientOptions, loadEditorLookups } from "@/lib/quote-editor-data";
import { loadProposal } from "@/lib/proposal-loader";
import { displayStatus, formatDateBR } from "@/lib/quote-status";
import { centsToInput, formatBRL } from "@/lib/money";
import { formatCnpj } from "@/lib/cnpj";
import type { AuditEntry, QuoteItem } from "@/lib/types";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await requireProfile();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const loaded = await loadProposal(supabase, id);
  if (!loaded) notFound();
  const { quote, data } = loaded;

  const [versions, audit, itemsRes] = await Promise.all([
    supabase.from("quotes").select("id,version,status,total_cents,created_at").eq("number", quote.number).order("version", { ascending: false }),
    supabase.from("audit_log").select("id,at,user_email,table_name,action,changed_fields").eq("context_id", id).order("at", { ascending: false }).limit(60),
    supabase.from("quote_items").select("*").eq("quote_id", id).order("position"),
  ]);
  const items = (itemsRes.data ?? []) as QuoteItem[];
  const status = displayStatus(quote.status, quote.validity_date);
  const editable = canWrite(profile) && quote.is_current && quote.status === "elaboracao";

  let editor: React.ReactNode = null;
  if (editable) {
    const [{ clients, services }, opts] = await Promise.all([loadEditorLookups(supabase), loadClientOptions(supabase, quote.client_id)]);
    const initial: EditorValues = {
      client_id: quote.client_id,
      unit_id: quote.unit_id ?? "",
      contact_id: quote.contact_id ?? "",
      subject: quote.subject,
      validity_date: quote.validity_date,
      delivery_days: quote.delivery_days === null ? "" : String(quote.delivery_days),
      payment_terms: quote.payment_terms,
      internal_notes: quote.internal_notes,
      items: items.map((i) => ({
        service_id: i.service_id, code: i.code, name: i.name, description: i.description, technical_scope: i.technical_scope,
        inclusions: i.inclusions, exclusions: i.exclusions, specific_clauses: i.specific_clauses, unit_label: i.unit_label,
        quantity: String(Number(i.quantity)).replace(".", ","), price: centsToInput(Number(i.unit_price_cents)),
        discount: String(Number(i.discount_percent)).replace(".", ","),
      })),
    };
    editor = (
      <QuoteEditor
        key={`${quote.updated_at}-${items.length}`}
        quoteId={quote.id}
        initial={initial}
        clients={clients}
        services={services}
        maxDiscount={profile.role === "admin" ? 100 : Number(profile.max_discount_percent)}
        initialUnits={opts.units}
        initialContacts={opts.contacts}
      />
    );
  }

  return (
    <>
      <BackLink href="/orcamentos">Orçamentos</BackLink>
      <PageHeader
        title={`Proposta #${quote.number} · versão ${quote.version}`}
        subtitle={`${data.client.razao_social} · CNPJ ${formatCnpj(data.client.cnpj)}`}
        actions={<StatusBadge status={status} />}
      />
      {!quote.is_current && (
        <Notice tone="warning">Esta é uma versão anterior, preservada apenas para consulta. Veja a versão atual na lista de versões abaixo.</Notice>
      )}
      {status === "vencida" && <Notice tone="warning">A validade desta proposta expirou em {formatDateBR(quote.validity_date)}. Crie uma nova versão para renovar.</Notice>}
      {quote.decision_note && <Notice tone="info">Observação do registro de resposta: {quote.decision_note}</Notice>}

      <div className="space-y-6">
        {editable ? (
          editor
        ) : (
          <section className="card">
            <dl className="grid gap-3 text-sm md:grid-cols-3">
              <div><dt className="label">Assunto</dt><dd>{quote.subject || "-"}</dd></div>
              <div><dt className="label">Unidade</dt><dd>{data.unit?.name ?? "Todas / não especificada"}</dd></div>
              <div><dt className="label">Contato</dt><dd>{data.contact?.name ?? "-"}</dd></div>
              <div><dt className="label">Validade</dt><dd>{formatDateBR(quote.validity_date)}</dd></div>
              <div><dt className="label">Prazo de entrega</dt><dd>{quote.delivery_days === null ? "-" : `${quote.delivery_days} dias`}</dd></div>
              <div><dt className="label">Enviada em</dt><dd>{formatDateBR(quote.sent_at)}</dd></div>
              <div className="md:col-span-3"><dt className="label">Condições de pagamento</dt><dd>{quote.payment_terms}</dd></div>
            </dl>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-slate-50">
                  <tr><th className="th">Serviço</th><th className="th text-right">Qtd.</th><th className="th text-right">Valor unit.</th><th className="th text-right">Desc.</th><th className="th text-right">Total</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((i) => (
                    <tr key={i.id}>
                      <td className="td">{i.name}</td>
                      <td className="td text-right">{Number(i.quantity)}</td>
                      <td className="td text-right">{formatBRL(i.unit_price_cents)}</td>
                      <td className="td text-right">{Number(i.discount_percent) > 0 ? `${Number(i.discount_percent)}%` : "-"}</td>
                      <td className="td text-right font-medium">{formatBRL(i.total_cents)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-3 ml-auto max-w-xs space-y-1 text-sm">
              <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(quote.subtotal_cents)}</span></div>
              <div className="flex justify-between text-slate-600"><span>Descontos</span><span>- {formatBRL(quote.discount_cents)}</span></div>
              <div className="flex justify-between rounded-md bg-accent-600 px-3 py-2 text-base font-bold text-white"><span>Total</span><span>{formatBRL(quote.total_cents)}</span></div>
            </div>
          </section>
        )}

        <QuoteActions
          quoteId={quote.id}
          status={quote.status}
          isCurrent={quote.is_current}
          canWrite={canWrite(profile)}
          pendingTemplates={loaded.selection.pendingKeys.length > 0}
        />

        <section className="card">
          <h2 className="mb-3 text-lg font-semibold text-brand-900">Versões desta proposta</h2>
          <ul className="space-y-1 text-sm">
            {(versions.data ?? []).map((v) => (
              <li key={v.id}>
                <Link href={`/orcamentos/${v.id}`} className={`text-brand-700 hover:underline ${v.id === id ? "font-bold" : ""}`}>Versão {v.version}</Link>
                <span className="text-slate-500"> · {formatBRL(v.total_cents)} · {new Date(v.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</span>
              </li>
            ))}
          </ul>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold text-brand-900">Histórico de alterações</h2>
          <AuditHistory entries={(audit.data ?? []) as AuditEntry[]} />
        </section>
      </div>
    </>
  );
}
