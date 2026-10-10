"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveService } from "@/app/(app)/servicos/actions";
import { FieldError, Notice } from "@/components/ui";
import { SERVICE_CATEGORIES } from "@/lib/service-categories";
import { centsToInput, parseBRLToCents } from "@/lib/money";
import type { Service } from "@/lib/types";

export interface ServiceFormValues {
  id?: string;
  code: string;
  name: string;
  category: string;
  commercial_description: string;
  technical_scope: string;
  price: string;
  unit_label: string;
  delivery_days: string;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  active: boolean;
}

export const emptyService: ServiceFormValues = {
  code: "", name: "", category: "outros", commercial_description: "", technical_scope: "", price: "0,00",
  unit_label: "un", delivery_days: "", inclusions: "", exclusions: "", specific_clauses: "", active: true,
};

export const toFormValues = (s: Service): ServiceFormValues => ({
  id: s.id, code: s.code, name: s.name, category: s.category, commercial_description: s.commercial_description,
  technical_scope: s.technical_scope, price: centsToInput(s.suggested_price_cents), unit_label: s.unit_label,
  delivery_days: s.delivery_days === null ? "" : String(s.delivery_days), inclusions: s.inclusions,
  exclusions: s.exclusions, specific_clauses: s.specific_clauses, active: s.active,
});

export function ServiceForm({ initial, readOnly = false }: { initial: ServiceFormValues; readOnly?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const set = <K extends keyof ServiceFormValues>(k: K, val: ServiceFormValues[K]) => setV((p) => ({ ...p, [k]: val }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const cents = parseBRLToCents(v.price);
    if (cents === null) return setErrors({ suggested_price_cents: "Valor inválido" });
    const days = v.delivery_days.trim() === "" ? null : Number(v.delivery_days);
    if (days !== null && !Number.isInteger(days)) return setErrors({ delivery_days: "Informe número de dias inteiro" });
    start(async () => {
      const r = await saveService(initial.id ?? null, {
        code: v.code, name: v.name, category: v.category as never, commercial_description: v.commercial_description,
        technical_scope: v.technical_scope, suggested_price_cents: cents, unit_label: v.unit_label, delivery_days: days,
        inclusions: v.inclusions, exclusions: v.exclusions, specific_clauses: v.specific_clauses, active: v.active,
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return setMessage({ tone: "error", text: r.error ?? "Erro ao salvar." });
      }
      setErrors({});
      if (initial.id) {
        setMessage({ tone: "success", text: "Serviço salvo." });
        router.refresh();
      } else router.push(`/servicos/${r.data!.id}`);
    });
  }

  const area = (k: keyof ServiceFormValues, label: string, hint?: string) => (
    <div>
      <label className="label">{label}</label>
      {hint && <p className="mb-1 text-xs text-slate-500">{hint}</p>}
      <textarea className="field min-h-28" disabled={readOnly} value={String(v[k])} onChange={(e) => set(k, e.target.value as never)} />
      <FieldError message={errors[k]} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}
      <section className="card grid gap-4 md:grid-cols-6">
        <div className="md:col-span-1">
          <label className="label">Código *</label>
          <input className="field uppercase" disabled={readOnly} value={v.code} onChange={(e) => set("code", e.target.value)} placeholder="PGR" />
          <FieldError message={errors.code} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Nome do serviço *</label>
          <input className="field" disabled={readOnly} value={v.name} onChange={(e) => set("name", e.target.value)} />
          <FieldError message={errors.name} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Categoria</label>
          <select className="field" disabled={readOnly} value={v.category} onChange={(e) => set("category", e.target.value)}>
            {SERVICE_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="label">Preço sugerido (R$)</label>
          <input className="field" inputMode="decimal" disabled={readOnly} value={v.price} onChange={(e) => set("price", e.target.value)} />
          <FieldError message={errors.suggested_price_cents} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Unidade de cobrança</label>
          <input className="field" disabled={readOnly} value={v.unit_label} onChange={(e) => set("unit_label", e.target.value)} placeholder="un, funcionário, hora…" />
          <FieldError message={errors.unit_label} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Prazo de entrega (dias)</label>
          <input className="field" inputMode="numeric" disabled={readOnly} value={v.delivery_days} onChange={(e) => set("delivery_days", e.target.value)} />
          <FieldError message={errors.delivery_days} />
        </div>
      </section>
      <section className="card space-y-4">
        {area("commercial_description", "Descrição comercial", "Texto de venda, em linguagem acessível ao cliente.")}
        {area("technical_scope", "Escopo técnico", "Etapas e entregáveis. Aparece na seção “Escopo técnico” da proposta.")}
        {area("inclusions", "O que está incluso", "Um item por linha.")}
        {area("exclusions", "O que não está incluso", "Um item por linha.")}
        {area("specific_clauses", "Cláusulas específicas do serviço", "Somente textos previamente aprovados pelo jurídico.")}
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" disabled={readOnly} checked={v.active} onChange={(e) => set("active", e.target.checked)} /> Serviço ativo (disponível para novos orçamentos)
        </label>
      </section>
      {!readOnly && <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar serviço"}</button>}
    </form>
  );
}
