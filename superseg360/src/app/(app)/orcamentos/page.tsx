import Link from "next/link";
import { requireProfile, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/search";
import { displayStatus, formatDateBR, STATUS_LABEL, todayISO, type QuoteDisplayStatus, type QuoteStatus } from "@/lib/quote-status";
import { formatBRL } from "@/lib/money";
import { EmptyState, PageHeader, StatusBadge } from "@/components/ui";

type Row = {
  id: string; number: number; version: number; status: QuoteStatus; validity_date: string; total_cents: number;
  subject: string; created_at: string; clients: { razao_social: string; nome_fantasia: string | null } | null;
};

export default async function QuotesPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const profile = await requireProfile();
  const sp = await searchParams;
  const q = sanitizeSearch(sp.q);
  const filter = (Object.keys(STATUS_LABEL) as QuoteDisplayStatus[]).find((s) => s === sp.status);
  const today = todayISO();
  const supabase = await createClient();

  let query = supabase
    .from("quotes")
    .select("id,number,version,status,validity_date,total_cents,subject,created_at,clients!inner(razao_social,nome_fantasia)")
    .eq("is_current", true)
    .order("created_at", { ascending: false })
    .limit(300);
  if (filter === "vencida") query = query.eq("status", "enviada").lt("validity_date", today);
  else if (filter === "enviada") query = query.eq("status", "enviada").gte("validity_date", today);
  else if (filter) query = query.eq("status", filter);
  if (q) {
    const n = Number(q);
    if (Number.isInteger(n) && n > 0) query = query.eq("number", n);
    else query = query.or(`razao_social.ilike.%${q}%,nome_fantasia.ilike.%${q}%`, { referencedTable: "clients" });
  }
  const { data } = await query;
  const rows = (data ?? []) as unknown as Row[];

  return (
    <>
      <PageHeader
        title="Orçamentos e propostas"
        actions={canWrite(profile) && <Link href="/orcamentos/novo" className="btn-primary">+ Novo orçamento</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Número ou nome do cliente" className="field max-w-xs" />
        <select name="status" defaultValue={filter ?? ""} className="field max-w-48" aria-label="Situação">
          <option value="">Todas as situações</option>
          {(Object.keys(STATUS_LABEL) as QuoteDisplayStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
        <button className="btn-secondary">Filtrar</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState>Nenhum orçamento encontrado.</EmptyState>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className="th">Nº</th><th className="th">Cliente</th><th className="th">Assunto</th><th className="th">Situação</th><th className="th">Validade</th><th className="th text-right">Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="td whitespace-nowrap"><Link className="font-medium text-brand-700 hover:underline" href={`/orcamentos/${r.id}`}>#{r.number} v{r.version}</Link></td>
                  <td className="td">{r.clients?.razao_social}</td>
                  <td className="td text-slate-600">{r.subject}</td>
                  <td className="td"><StatusBadge status={displayStatus(r.status, r.validity_date, today)} /></td>
                  <td className="td whitespace-nowrap">{formatDateBR(r.validity_date)}</td>
                  <td className="td whitespace-nowrap text-right font-medium">{formatBRL(r.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
