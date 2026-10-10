import Link from "next/link";
import { requireProfile, isAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/search";
import { categoryLabel } from "@/lib/service-categories";
import { formatBRL } from "@/lib/money";
import { EmptyState, PageHeader } from "@/components/ui";
import type { Service } from "@/lib/types";

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const profile = await requireProfile();
  const q = sanitizeSearch((await searchParams).q);
  const supabase = await createClient();
  let query = supabase
    .from("services")
    .select("id,code,name,category,suggested_price_cents,unit_label,delivery_days,active")
    .order("code");
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);
  const { data } = await query;
  const services = (data ?? []) as Service[];
  return (
    <>
      <PageHeader
        title="Catálogo de serviços"
        subtitle="Serviços de SST oferecidos pela SuperSeg."
        actions={isAdmin(profile) && <Link href="/servicos/novo" className="btn-primary">+ Novo serviço</Link>}
      />
      <form className="mb-4 flex gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por código ou nome" className="field max-w-md" />
        <button className="btn-secondary">Buscar</button>
      </form>
      {services.length === 0 ? (
        <EmptyState>Nenhum serviço cadastrado.{isAdmin(profile) ? " Cadastre o primeiro em “Novo serviço”." : ""}</EmptyState>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className="th">Código</th><th className="th">Serviço</th><th className="th">Categoria</th><th className="th text-right">Preço sugerido</th><th className="th">Prazo</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="td font-mono text-xs">{s.code}</td>
                  <td className="td">
                    <Link href={`/servicos/${s.id}`} className="font-medium text-brand-700 hover:underline">{s.name}</Link>
                    {!s.active && <span className="ml-1 text-xs font-semibold text-amber-700">(inativo)</span>}
                  </td>
                  <td className="td text-slate-600">{categoryLabel(s.category)}</td>
                  <td className="td text-right whitespace-nowrap">{formatBRL(s.suggested_price_cents)} / {s.unit_label}</td>
                  <td className="td">{s.delivery_days === null ? "-" : `${s.delivery_days} dias`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
