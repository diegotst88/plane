import Link from "next/link";
import { requireProfile, canWrite } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { sanitizeSearch } from "@/lib/search";
import { formatCnpj, normalizeCnpj } from "@/lib/cnpj";
import { EmptyState, PageHeader } from "@/components/ui";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; inativos?: string }>;
}) {
  const profile = await requireProfile();
  const { q: rawQ, inativos } = await searchParams;
  const q = sanitizeSearch(rawQ);
  const supabase = await createClient();

  let query = supabase
    .from("clients")
    .select("id,razao_social,nome_fantasia,cnpj,cidade,uf,active")
    .order("razao_social")
    .limit(200);
  if (!inativos) query = query.eq("active", true);
  if (q) {
    const digits = normalizeCnpj(q);
    const filters = [`razao_social.ilike.%${q}%`, `nome_fantasia.ilike.%${q}%`];
    if (digits.length >= 3) filters.push(`cnpj.ilike.%${digits}%`);
    query = query.or(filters.join(","));
  }
  const { data: clients, error } = await query;

  return (
    <>
      <PageHeader
        title="Clientes"
        subtitle="Cadastro único de empresas atendidas."
        actions={canWrite(profile) && <Link href="/clientes/novo" className="btn-primary">+ Nova empresa</Link>}
      />
      <form className="mb-4 flex flex-wrap gap-2" role="search">
        <input name="q" defaultValue={q} placeholder="Buscar por razão social, nome fantasia ou CNPJ" className="field max-w-md" />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="inativos" value="1" defaultChecked={!!inativos} /> Incluir inativas
        </label>
        <button className="btn-secondary">Buscar</button>
      </form>
      {error && <p className="text-sm text-red-600">Erro ao carregar clientes.</p>}
      {!clients?.length ? (
        <EmptyState>Nenhuma empresa encontrada.</EmptyState>
      ) : (
        <div className="card overflow-x-auto p-0">
          <table className="w-full">
            <thead className="border-b border-slate-200 bg-slate-50">
              <tr><th className="th">Razão social</th><th className="th">CNPJ</th><th className="th">Cidade</th><th className="th" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {clients.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="td">
                    <Link href={`/clientes/${c.id}`} className="font-medium text-brand-700 hover:underline">{c.razao_social}</Link>
                    {c.nome_fantasia && <span className="block text-xs text-slate-500">{c.nome_fantasia}</span>}
                    {!c.active && <span className="ml-1 text-xs font-semibold text-amber-700">(inativa)</span>}
                  </td>
                  <td className="td whitespace-nowrap">{formatCnpj(c.cnpj)}</td>
                  <td className="td">{[c.cidade, c.uf].filter(Boolean).join("/")}</td>
                  <td className="td text-right">
                    {canWrite(profile) && c.active && (
                      <Link href={`/orcamentos/novo?cliente=${c.id}`} className="text-sm text-accent-600 hover:underline">Novo orçamento</Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
