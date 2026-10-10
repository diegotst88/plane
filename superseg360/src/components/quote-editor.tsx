"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { getClientOptions, saveQuote } from "@/app/(app)/orcamentos/actions";
import { FieldError, Notice } from "@/components/ui";
import { calcItem, calcQuote } from "@/lib/quote-calc";
import { centsToInput, formatBRL, parseBRLToCents } from "@/lib/money";

export interface EditorItem {
  service_id: string | null;
  code: string;
  name: string;
  description: string;
  technical_scope: string;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  unit_label: string;
  quantity: string;
  price: string;
  discount: string;
}

export interface EditorValues {
  client_id: string;
  unit_id: string;
  contact_id: string;
  subject: string;
  validity_date: string;
  delivery_days: string;
  payment_terms: string;
  internal_notes: string;
  items: EditorItem[];
}

export interface ServiceOption {
  id: string;
  code: string;
  name: string;
  description: string;
  technical_scope: string;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  unit_label: string;
  suggested_price_cents: number;
  delivery_days: number | null;
}

interface Option { id: string; name: string }
interface ContactOption extends Option { email: string | null; is_primary: boolean }

const PAYMENT_PRESETS = [
  "À vista, na assinatura da proposta",
  "50% na assinatura e 50% na entrega",
  "Boleto bancário para 28 dias após a entrega",
  "3 parcelas iguais (30/60/90 dias)",
];

const toNumber = (s: string) => {
  const n = Number(s.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};

export function QuoteEditor({
  quoteId,
  initial,
  clients,
  services,
  maxDiscount,
  initialUnits,
  initialContacts,
}: {
  quoteId: string | null;
  initial: EditorValues;
  clients: { id: string; label: string }[];
  services: ServiceOption[];
  maxDiscount: number;
  initialUnits: Option[];
  initialContacts: ContactOption[];
}) {
  const router = useRouter();
  const [v, setV] = useState(initial);
  const [units, setUnits] = useState(initialUnits);
  const [contacts, setContacts] = useState(initialContacts);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [serviceToAdd, setServiceToAdd] = useState("");

  const set = <K extends keyof EditorValues>(k: K, val: EditorValues[K]) => setV((p) => ({ ...p, [k]: val }));

  useEffect(() => {
    if (!v.client_id) return;
    if (v.client_id === initial.client_id && initialUnits.length + initialContacts.length > 0) return;
    let cancelled = false;
    getClientOptions(v.client_id).then((o) => {
      if (cancelled) return;
      setUnits(o.units);
      setContacts(o.contacts);
      setV((p) => ({
        ...p,
        unit_id: o.units.some((u) => u.id === p.unit_id) ? p.unit_id : "",
        contact_id: o.contacts.some((c) => c.id === p.contact_id) ? p.contact_id : (o.contacts.find((c) => c.is_primary)?.id ?? ""),
      }));
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v.client_id]);

  const computed = useMemo(() => {
    const rows = v.items.map((it) => {
      const quantity = toNumber(it.quantity);
      const price = parseBRLToCents(it.price);
      const discount = it.discount.trim() === "" ? 0 : toNumber(it.discount);
      const valid = quantity > 0 && price !== null && Number.isFinite(discount) && discount >= 0 && discount <= 100;
      const totals = valid ? calcItem({ quantity, unitPriceCents: price!, discountPercent: discount }) : null;
      return { quantity, price, discount, valid, totals };
    });
    const totals = calcQuote(
      rows.filter((r) => r.valid).map((r) => ({ quantity: r.quantity, unitPriceCents: r.price!, discountPercent: r.discount })),
    );
    return { rows, totals };
  }, [v.items]);

  function addService() {
    const s = services.find((x) => x.id === serviceToAdd);
    if (!s) return;
    setV((p) => {
      const days = [p.delivery_days ? Number(p.delivery_days) : 0, s.delivery_days ?? 0];
      return {
        ...p,
        delivery_days: String(Math.max(...days) || ""),
        items: [
          ...p.items,
          {
            service_id: s.id, code: s.code, name: s.name, description: s.description, technical_scope: s.technical_scope,
            inclusions: s.inclusions, exclusions: s.exclusions, specific_clauses: s.specific_clauses, unit_label: s.unit_label,
            quantity: "1", price: centsToInput(s.suggested_price_cents), discount: "0",
          },
        ],
      };
    });
    setServiceToAdd("");
  }

  function addCustom() {
    set("items", [
      ...v.items,
      { service_id: null, code: "AVULSO", name: "", description: "", technical_scope: "", inclusions: "", exclusions: "", specific_clauses: "", unit_label: "un", quantity: "1", price: "0,00", discount: "0" },
    ]);
  }

  const updItem = (i: number, patch: Partial<EditorItem>) =>
    set("items", v.items.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const bad = computed.rows.findIndex((r) => !r.valid);
    if (bad >= 0) {
      setErrors({ [`items.${bad}.quantity`]: "Confira quantidade, valor e desconto deste item" });
      return setMessage({ tone: "error", text: `Item ${bad + 1}: quantidade, valor ou desconto inválido.` });
    }
    const over = computed.rows.findIndex((r) => r.discount > maxDiscount);
    if (over >= 0) {
      setErrors({ [`items.${over}.discount_percent`]: `Máximo ${maxDiscount}% para o seu perfil` });
      return setMessage({ tone: "error", text: `Item ${over + 1}: desconto acima do limite autorizado (${maxDiscount}%). Solicite a um administrador.` });
    }
    const days = v.delivery_days.trim() === "" ? null : Number(v.delivery_days);
    start(async () => {
      const r = await saveQuote(quoteId, {
        client_id: v.client_id,
        unit_id: v.unit_id || null,
        contact_id: v.contact_id || null,
        subject: v.subject,
        validity_date: v.validity_date,
        delivery_days: days !== null && Number.isInteger(days) ? days : null,
        payment_terms: v.payment_terms,
        internal_notes: v.internal_notes,
        items: v.items.map((it, i) => ({
          service_id: it.service_id, code: it.code, name: it.name, description: it.description,
          technical_scope: it.technical_scope, inclusions: it.inclusions, exclusions: it.exclusions,
          specific_clauses: it.specific_clauses, unit_label: it.unit_label,
          quantity: computed.rows[i]!.quantity, unit_price_cents: computed.rows[i]!.price!, discount_percent: computed.rows[i]!.discount,
        })),
      });
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        return setMessage({ tone: "error", text: r.error ?? "Erro ao salvar." });
      }
      setErrors({});
      if (quoteId) {
        setMessage({ tone: "success", text: "Orçamento salvo." });
        router.refresh();
      } else router.push(`/orcamentos/${r.data!.id}`);
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="card grid gap-4 md:grid-cols-6">
        <div className="md:col-span-3">
          <label className="label">Cliente *</label>
          <select className="field" value={v.client_id} onChange={(e) => set("client_id", e.target.value)} required>
            <option value="">Selecione…</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          <FieldError message={errors.client_id} />
        </div>
        <div className="md:col-span-3">
          <label className="label">Unidade atendida</label>
          <select className="field" value={v.unit_id} onChange={(e) => set("unit_id", e.target.value)} disabled={!v.client_id}>
            <option value="">Todas / não especificada</option>
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Contato / destinatário</label>
          <select className="field" value={v.contact_id} onChange={(e) => set("contact_id", e.target.value)} disabled={!v.client_id}>
            <option value="">Não especificado</option>
            {contacts.map((c) => <option key={c.id} value={c.id}>{c.name}{c.email ? ` (${c.email})` : ""}</option>)}
          </select>
        </div>
        <div className="md:col-span-3">
          <label className="label">Assunto / objeto resumido</label>
          <input className="field" value={v.subject} onChange={(e) => set("subject", e.target.value)} placeholder="Ex.: Elaboração do PGR e PCMSO" />
        </div>
      </section>

      <section className="card">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-semibold text-brand-900">Serviços</h2>
          <div className="flex flex-wrap items-end gap-2">
            <select className="field w-72" value={serviceToAdd} onChange={(e) => setServiceToAdd(e.target.value)} aria-label="Serviço a adicionar">
              <option value="">Selecione um serviço do catálogo…</option>
              {services.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
            </select>
            <button type="button" className="btn-accent" onClick={addService} disabled={!serviceToAdd}>Adicionar</button>
            <button type="button" className="btn-secondary" onClick={addCustom}>+ Item avulso</button>
          </div>
        </div>
        <FieldError message={errors.items} />
        {v.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">Nenhum serviço adicionado.</p>
        ) : (
          <div className="space-y-3">
            {v.items.map((it, i) => {
              const row = computed.rows[i]!;
              const overLimit = row.valid && row.discount > maxDiscount;
              return (
                <div key={i} className="rounded-lg border border-slate-200 p-3">
                  <div className="grid gap-3 md:grid-cols-12">
                    <div className="md:col-span-5">
                      <label className="label">Serviço</label>
                      <input className="field" value={it.name} onChange={(e) => updItem(i, { name: e.target.value })} readOnly={!!it.service_id} />
                      <FieldError message={errors[`items.${i}.name`]} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Quantidade ({it.unit_label})</label>
                      <input className="field text-right" inputMode="decimal" value={it.quantity} onChange={(e) => updItem(i, { quantity: e.target.value })} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="label">Valor unit. (R$)</label>
                      <input className="field text-right" inputMode="decimal" value={it.price} onChange={(e) => updItem(i, { price: e.target.value })} />
                    </div>
                    <div className="md:col-span-1">
                      <label className="label">Desc. %</label>
                      <input className={`field text-right ${overLimit ? "border-red-500" : ""}`} inputMode="decimal" value={it.discount} onChange={(e) => updItem(i, { discount: e.target.value })} />
                    </div>
                    <div className="flex items-end justify-between md:col-span-2">
                      <div className="text-right">
                        <p className="label mb-0">Total</p>
                        <p className="text-base font-bold text-brand-900">{row.totals ? formatBRL(row.totals.totalCents) : "-"}</p>
                      </div>
                      <button type="button" className="pb-1 text-xs text-red-600 hover:underline" onClick={() => set("items", v.items.filter((_, j) => j !== i))}>
                        Remover
                      </button>
                    </div>
                  </div>
                  {(errors[`items.${i}.quantity`] || errors[`items.${i}.discount_percent`] || overLimit) && (
                    <p className="mt-1 text-xs text-red-600">
                      {errors[`items.${i}.quantity`] ?? errors[`items.${i}.discount_percent`] ?? `Desconto acima do seu limite (${maxDiscount}%). Somente administradores podem conceder mais.`}
                    </p>
                  )}
                  {it.service_id === null && (
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <div>
                        <label className="label">Escopo técnico</label>
                        <textarea className="field min-h-20" value={it.technical_scope} onChange={(e) => updItem(i, { technical_scope: e.target.value })} />
                      </div>
                      <div>
                        <label className="label">Descrição comercial</label>
                        <textarea className="field min-h-20" value={it.description} onChange={(e) => updItem(i, { description: e.target.value })} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 ml-auto max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{formatBRL(computed.totals.subtotalCents)}</span></div>
          <div className="flex justify-between text-slate-600"><span>Descontos</span><span>- {formatBRL(computed.totals.discountCents)}</span></div>
          <div className="flex justify-between rounded-md bg-accent-600 px-3 py-2 text-base font-bold text-white">
            <span>Total</span><span>{formatBRL(computed.totals.totalCents)}</span>
          </div>
        </div>
      </section>

      <section className="card grid gap-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="label">Validade da proposta *</label>
          <input type="date" className="field" value={v.validity_date} onChange={(e) => set("validity_date", e.target.value)} required />
          <FieldError message={errors.validity_date} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Prazo de entrega (dias)</label>
          <input className="field" inputMode="numeric" value={v.delivery_days} onChange={(e) => set("delivery_days", e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Modelo de pagamento</label>
          <select className="field" value="" onChange={(e) => e.target.value && set("payment_terms", e.target.value)}>
            <option value="">Escolher um modelo…</option>
            {PAYMENT_PRESETS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="md:col-span-6">
          <label className="label">Condições de pagamento *</label>
          <textarea className="field min-h-20" value={v.payment_terms} onChange={(e) => set("payment_terms", e.target.value)} required />
          <FieldError message={errors.payment_terms} />
        </div>
        <div className="md:col-span-6">
          <label className="label">Observações internas (não aparecem no PDF)</label>
          <textarea className="field min-h-16" value={v.internal_notes} onChange={(e) => set("internal_notes", e.target.value)} />
        </div>
      </section>

      <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar orçamento"}</button>
    </form>
  );
}
