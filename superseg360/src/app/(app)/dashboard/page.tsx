import Link from "next/link";
import { requireProfile, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PageHeader, StatusBadge } from "@/components/ui";
import { displayStatus, formatDateBR, type QuoteStatus } from "@/lib/quote-status";
import { formatBRL } from "@/lib/money";

interface Dash {
  clients: number; elaboracao: number; enviadas: number; aprovadas: number; recusadas: number; vencidas: number;
  valor_aberto_cents: number; valor_aprovado_cents: number;
}

export default async function DashboardPage() {
  const profile = await requireProfile();
  const supabase = await createClient();
  const [{ data: dash }, recent] = await Promise.all([
    supabase.rpc("commercial_dashboard"),
    supabase
      .from("quotes")
      .select("id,number,version,status,validity_date,total_cents,clients(razao_social)")
      .eq("is_current", true)
      .order("updated_at", { ascending: false })
      .limit(8),
  ]);
  const d = (dash ?? {}) as Partial<Dash>;
  const cards = [
    { label: "Clientes cadastrados", value: d.clients ?? 0, href: "/clientes", tone: "border-brand-500" },
    { label: "Propostas em elaboração", value: d.elaboracao ?? 0, href: "/orcamentos?status=elaboracao", tone: "border-slate-400" },
    { label: "Propostas enviadas", value: d.enviadas ?? 0, href: "/orcamentos?status=enviada", tone: "border-brand-500" },
    { label: "Propostas aprovadas", value: d.aprovadas ?? 0, href: "/orcamentos?status=aprovada", tone: "border-accent-500" },
    { label: "Propostas recusadas", value: d.recusadas ?? 0, href: "/orcamentos?status=recusada", tone: "border-red-400" },
    { label: "Propostas vencidas", value: d.vencidas ?? 0, href: "/orcamentos?status=vencida", tone: "border-amber-400" },
  ];
  const rows = (recent.data ?? []) as unknown as {
    id: string; number: number; version: number; status: QuoteStatus; validity_date: string; total_cents: number;
    clients: { razao_social: string } | null;
  }[];
  return (
    <>
      <PageHeader
        title={`Olá, ${profile.full_name.split(" ")[0] || "bem-vindo"}`}
        subtitle="Painel comercial"
        actions={canWrite(profile) && <Link href="/orcamentos/novo" className="btn-accent">+ Novo orçamento</Link>}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link key={c.label} href={c.href} className={`card border-l-4 ${c.tone} transition hover:shadow-md`}>
            <p className="text-sm text-slate-600">{c.label}</p>
            <p className="mt-1 text-3xl font-extrabold text-brand-900">{c.value}</p>
          </Link>
        ))}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="card"><p className="text-sm text-slate-600">Valor em propostas enviadas (em aberto)</p><p className="mt-1 text-2xl font-bold text-brand-700">{formatBRL(d.valor_aberto_cents ?? 0)}</p></div>
        <div className="card"><p className="text-sm text-slate-600">Valor em propostas aprovadas</p><p className="mt-1 text-2xl font-bold text-accent-600">{formatBRL(d.valor_aprovado_cents ?? 0)}</p></div>
      </div>
      <section className="card mt-6">
        <h2 className="mb-3 text-lg font-semibold text-brand-900">Atividade recente</h2>
        {rows.length === 0 ? (
          <p className="text-sm text-slate-500">Nenhuma proposta criada ainda.</p>
        ) : (
          <table className="w-full">
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="td"><Link className="font-medium text-brand-700 hover:underline" href={`/orcamentos/${r.id}`}>#{r.number} v{r.version}</Link></td>
                  <td className="td">{r.clients?.razao_social}</td>
                  <td className="td"><StatusBadge status={displayStatus(r.status, r.validity_date)} /></td>
                  <td className="td text-slate-500">até {formatDateBR(r.validity_date)}</td>
                  <td className="td text-right font-medium">{formatBRL(r.total_cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}
