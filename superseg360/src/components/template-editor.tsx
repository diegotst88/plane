"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { approveTemplate, createTemplateDraft, updateTemplateDraft } from "@/app/(app)/modelos/actions";
import { Notice } from "@/components/ui";

export interface TemplateView {
  id: string;
  version: number;
  status: "draft" | "approved" | "archived";
  title: string;
  body: string;
  approved_at: string | null;
}

export function TemplateEditor({ templateKey, approved, draft }: { templateKey: string; approved: TemplateView | null; draft: TemplateView | null }) {
  const router = useRouter();
  const base = draft ?? approved;
  const [title, setTitle] = useState(base?.title ?? "");
  const [body, setBody] = useState(base?.body ?? "");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, ok: string) =>
    start(async () => {
      const r = await fn();
      setMessage(r.ok ? { tone: "success", text: ok } : { tone: "error", text: r.error ?? "Erro." });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-3">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        {approved ? (
          <span className="rounded-full bg-accent-50 px-2 py-0.5 font-semibold text-accent-600">
            Vigente: versão {approved.version}{approved.approved_at ? ` (aprovada em ${new Date(approved.approved_at).toLocaleDateString("pt-BR")})` : ""}
          </span>
        ) : (
          <span className="rounded-full bg-amber-50 px-2 py-0.5 font-semibold text-amber-800">Nenhuma versão aprovada</span>
        )}
        {draft && <span className="rounded-full bg-slate-100 px-2 py-0.5 font-semibold text-slate-700">Rascunho: versão {draft.version}</span>}
      </div>
      <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} readOnly={!draft && !!approved} aria-label="Título" />
      <textarea className="field min-h-48 font-mono text-xs" value={body} onChange={(e) => setBody(e.target.value)} readOnly={!draft && !!approved} aria-label="Texto" />
      <div className="flex flex-wrap gap-2">
        {draft ? (
          <>
            <button className="btn-secondary" disabled={pending} onClick={() => run(() => updateTemplateDraft(draft.id, title, body), "Rascunho salvo.")}>Salvar rascunho</button>
            {!confirm ? (
              <button className="btn-accent" disabled={pending} onClick={() => setConfirm(true)}>Aprovar este texto…</button>
            ) : (
              <>
                <span className="self-center text-sm font-medium">Confirma que o texto foi revisado (e validado pelo jurídico, se contratual)? Salve o rascunho antes.</span>
                <button className="btn-accent" disabled={pending} onClick={() => run(() => approveTemplate(draft.id), "Texto aprovado e em vigor.")}>Sim, aprovar</button>
                <button className="btn-secondary" onClick={() => setConfirm(false)}>Cancelar</button>
              </>
            )}
          </>
        ) : (
          <button className="btn-secondary" disabled={pending || !approved} onClick={() => run(() => createTemplateDraft(templateKey, title, body), "Novo rascunho criado. Edite e aprove.")}>
            Criar nova versão (rascunho)
          </button>
        )}
      </div>
    </div>
  );
}
