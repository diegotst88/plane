import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { INTEGRATION_INFO, INTEGRATION_PROVIDERS, adapters } from "@/lib/integrations";
import { Notice, PageHeader } from "@/components/ui";

export default async function IntegrationsPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { count } = await supabase.from("integration_outbox").select("id", { count: "exact", head: true }).eq("status", "pending");
  return (
    <>
      <PageHeader title="Integrações" subtitle="Estrutura preparada para conexões futuras. Nenhuma integração está ativa nesta fase." />
      <Notice tone="info">
        Eventos do módulo comercial (proposta criada, enviada, aprovada, recusada) já são registrados em uma fila interna ({count ?? 0} pendente(s)),
        prontos para serem consumidos quando as integrações forem desenvolvidas. Credenciais nunca são guardadas no banco de dados.
      </Notice>
      <div className="grid gap-4 md:grid-cols-2">
        {INTEGRATION_PROVIDERS.map((p) => (
          <div key={p} className="card">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-brand-900">{INTEGRATION_INFO[p].label}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">{adapters[p] ? "Ativa" : "Não implementada"}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">{INTEGRATION_INFO[p].purpose}</p>
            <p className="mt-2 text-xs text-slate-500">Credenciais futuras: <code>{INTEGRATION_INFO[p].secretEnv}</code></p>
          </div>
        ))}
      </div>
    </>
  );
}
