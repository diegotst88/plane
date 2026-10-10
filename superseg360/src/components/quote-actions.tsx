"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createNewVersion, decideQuote, sendQuote } from "@/app/(app)/orcamentos/actions";
import { Notice } from "@/components/ui";
import type { QuoteStatus } from "@/lib/quote-status";

export function QuoteActions({
  quoteId,
  status,
  isCurrent,
  canWrite,
  pendingTemplates,
}: {
  quoteId: string;
  status: QuoteStatus;
  isCurrent: boolean;
  canWrite: boolean;
  pendingTemplates: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [confirmSend, setConfirmSend] = useState(false);

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: { id: string } }>, goToResult = false) =>
    start(async () => {
      setMessage(null);
      const r = await fn();
      if (!r.ok) return setMessage(r.error ?? "Erro.");
      if (goToResult && r.data) router.push(`/orcamentos/${r.data.id}`);
      else router.refresh();
    });

  return (
    <div className="card space-y-3">
      <h2 className="text-lg font-semibold text-brand-900">Ações</h2>
      {message && <Notice tone="error">{message}</Notice>}
      <div className="flex flex-wrap gap-2">
        <a className="btn-secondary" href={`/api/propostas/${quoteId}/pdf`} target="_blank" rel="noreferrer">Visualizar PDF</a>
        <a className="btn-secondary" href={`/api/propostas/${quoteId}/pdf?download=1`}>Baixar PDF</a>
      </div>

      {canWrite && isCurrent && status === "elaboracao" && (
        <div className="border-t border-slate-200 pt-3">
          {pendingTemplates && (
            <Notice tone="warning">
              Os modelos de texto (institucional e cláusulas) ainda não foram aprovados por um administrador. O PDF sai marcado
              como <strong>MINUTA</strong> e o envio fica bloqueado.
            </Notice>
          )}
          <p className="mb-2 text-sm text-slate-600">
            Antes de enviar, confira cálculos, identificação do cliente, escopo e cláusulas no PDF. Após o envio o orçamento
            não pode ser editado (somente nova versão).
          </p>
          {!confirmSend ? (
            <button className="btn-accent" onClick={() => setConfirmSend(true)} disabled={pending}>Marcar como enviada…</button>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium">Confirma que o PDF foi conferido e enviado ao cliente?</span>
              <button className="btn-accent" disabled={pending} onClick={() => run(() => sendQuote(quoteId))}>Sim, marcar como enviada</button>
              <button className="btn-secondary" onClick={() => setConfirmSend(false)}>Cancelar</button>
            </div>
          )}
        </div>
      )}

      {canWrite && isCurrent && status === "enviada" && (
        <div className="space-y-2 border-t border-slate-200 pt-3">
          <label className="label">Registrar resposta do cliente</label>
          <input className="field max-w-lg" placeholder="Observação (opcional): motivo, contato, etc." value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex gap-2">
            <button className="btn-accent" disabled={pending} onClick={() => run(() => decideQuote(quoteId, "aprovada", note))}>Proposta aprovada</button>
            <button className="btn-danger" disabled={pending} onClick={() => run(() => decideQuote(quoteId, "recusada", note))}>Proposta recusada</button>
          </div>
        </div>
      )}

      {canWrite && isCurrent && status !== "elaboracao" && (
        <div className="border-t border-slate-200 pt-3">
          <button
            className="btn-secondary"
            disabled={pending}
            onClick={() => run(() => createNewVersion(quoteId), true)}
          >
            Criar nova versão
          </button>
          <p className="mt-1 text-xs text-slate-500">Copia os dados para uma nova versão editável; a versão atual fica preservada no histórico.</p>
        </div>
      )}
    </div>
  );
}
