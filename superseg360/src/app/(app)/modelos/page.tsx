import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TemplateEditor, type TemplateView } from "@/components/template-editor";
import { Notice, PageHeader } from "@/components/ui";
import { TEMPLATE_KEYS, TEMPLATE_VARIABLES } from "@/lib/templates";

type Row = TemplateView & { key: string; kind: "institutional" | "contractual" };

export default async function TemplatesPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data } = await supabase.from("document_templates").select("id,key,kind,title,body,version,status,approved_at").order("version", { ascending: false });
  const rows = (data ?? []) as Row[];
  const pending = TEMPLATE_KEYS.filter((k) => !rows.some((r) => r.key === k && r.status === "approved"));

  return (
    <>
      <PageHeader title="Modelos de texto da proposta" subtitle="Textos institucionais e cláusulas contratuais usados no PDF. Cada alteração gera uma nova versão que só vale após aprovação." />
      {pending.length > 0 && (
        <Notice tone="warning">
          {pending.length} modelo(s) ainda sem aprovação. Enquanto isso, as propostas saem como <strong>MINUTA</strong> e não podem ser marcadas como enviadas.
        </Notice>
      )}
      <details className="card mb-6 text-sm">
        <summary className="cursor-pointer font-semibold text-brand-900">Campos automáticos disponíveis</summary>
        <ul className="mt-2 grid gap-1 md:grid-cols-2">
          {TEMPLATE_VARIABLES.map((v) => (
            <li key={v.name}><code className="rounded bg-slate-100 px-1">{`{{${v.name}}}`}</code> — {v.description}</li>
          ))}
        </ul>
      </details>
      <div className="space-y-6">
        {TEMPLATE_KEYS.map((key) => {
          const forKey = rows.filter((r) => r.key === key);
          const approved = forKey.find((r) => r.status === "approved") ?? null;
          const draft = forKey.find((r) => r.status === "draft") ?? null;
          const kind = forKey[0]?.kind;
          return (
            <section key={key} className="card">
              <h2 className="mb-1 text-lg font-semibold text-brand-900">{(draft ?? approved ?? forKey[0])?.title ?? key}</h2>
              <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
                {kind === "contractual" ? "Texto contratual/jurídico — alterar somente com validação jurídica" : "Texto institucional"} · chave: {key}
              </p>
              <TemplateEditor key={`${draft?.id}-${approved?.id}-${draft?.version}`} templateKey={key} approved={approved} draft={draft} />
            </section>
          );
        })}
      </div>
    </>
  );
}
