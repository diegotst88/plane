"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveClient, lookupCnpjAction, setClientActive } from "@/app/(app)/clientes/actions";
import { FieldError, Notice } from "@/components/ui";
import { formatCnpj, formatCep } from "@/lib/cnpj";
import type { ClientInput } from "@/lib/schemas";

type Contact = NonNullable<ClientInput["contacts"]>[number];
type Unit = NonNullable<ClientInput["units"]>[number];

export interface ClientFormValues {
  id?: string;
  active?: boolean;
  razao_social: string;
  nome_fantasia: string;
  cnpj: string;
  inscricao_estadual: string;
  ie_isento: boolean;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
  billing_cnpj: string;
  billing_name: string;
  notes: string;
  contacts: Contact[];
  units: Unit[];
}

export const emptyClient: ClientFormValues = {
  razao_social: "", nome_fantasia: "", cnpj: "", inscricao_estadual: "", ie_isento: false, cep: "",
  logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "", billing_cnpj: "",
  billing_name: "", notes: "", contacts: [], units: [],
};

const emptyContact = (): Contact => ({ id: null, name: "", role_title: "", email: "", phone: "", is_primary: false });
const emptyUnit = (): Unit => ({ id: null, name: "", cnpj: "", cep: "", logradouro: "", numero: "", complemento: "", bairro: "", cidade: "", uf: "" });

export function ClientForm({ initial, readOnly = false }: { initial: ClientFormValues; readOnly?: boolean }) {
  const router = useRouter();
  const [v, setV] = useState<ClientFormValues>(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const [looking, setLooking] = useState(false);

  const set = <K extends keyof ClientFormValues>(k: K, val: ClientFormValues[K]) => setV((p) => ({ ...p, [k]: val }));
  const err = (k: string) => errors[k];

  async function onLookup() {
    setMessage(null);
    setLooking(true);
    const r = await lookupCnpjAction(v.cnpj);
    setLooking(false);
    if (!r.data) return setMessage({ tone: "error", text: r.error ?? "Falha na consulta." });
    const d = r.data;
    setV((p) => ({
      ...p,
      cnpj: formatCnpj(d.cnpj),
      razao_social: p.razao_social || d.razao_social,
      nome_fantasia: p.nome_fantasia || d.nome_fantasia || "",
      cep: formatCep(d.cep ?? p.cep),
      logradouro: d.logradouro ?? p.logradouro,
      numero: d.numero ?? p.numero,
      complemento: d.complemento ?? p.complemento,
      bairro: d.bairro ?? p.bairro,
      cidade: d.cidade ?? p.cidade,
      uf: d.uf ?? p.uf,
      contacts:
        p.contacts.length === 0 && (d.email || d.phone)
          ? [{ ...emptyContact(), name: "Contato geral", email: d.email ?? "", phone: d.phone ?? "", is_primary: true }]
          : p.contacts,
    }));
    setMessage(
      r.ok
        ? { tone: "info", text: `Dados públicos carregados${d.situacao ? ` (situação cadastral: ${d.situacao})` : ""}. Confira antes de salvar.` }
        : { tone: "error", text: r.error ?? "" },
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setErrors({});
    start(async () => {
      const r = await saveClient(initial.id ?? null, v);
      if (!r.ok) {
        setErrors(r.fieldErrors ?? {});
        setMessage({ tone: "error", text: r.error ?? "Erro ao salvar." });
        if (!initial.id && r.data?.id) router.replace(`/clientes/${r.data.id}`);
        return;
      }
      if (initial.id) {
        setMessage({ tone: "success", text: "Cadastro salvo com sucesso." });
        router.refresh();
      } else {
        router.push(`/clientes/${r.data!.id}`);
      }
    });
  }

  const text = (k: keyof ClientFormValues, label: string, extra?: { className?: string; placeholder?: string }) => (
    <div className={extra?.className}>
      <label className="label">{label}</label>
      <input
        className="field"
        disabled={readOnly}
        placeholder={extra?.placeholder}
        value={String(v[k] ?? "")}
        onChange={(e) => set(k, e.target.value as never)}
      />
      <FieldError message={err(k)} />
    </div>
  );

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-brand-900">Dados da empresa</h2>
        <div className="grid gap-4 md:grid-cols-6">
          <div className="md:col-span-2">
            <label className="label">CNPJ *</label>
            <div className="flex gap-2">
              <input className="field" disabled={readOnly} value={v.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" inputMode="text" />
              {!readOnly && (
                <button type="button" className="btn-secondary whitespace-nowrap" onClick={onLookup} disabled={looking || !v.cnpj}>
                  {looking ? "Buscando…" : "Buscar"}
                </button>
              )}
            </div>
            <FieldError message={err("cnpj")} />
          </div>
          {text("razao_social", "Razão social *", { className: "md:col-span-4" })}
          {text("nome_fantasia", "Nome fantasia", { className: "md:col-span-3" })}
          <div className="md:col-span-2">
            <label className="label">Inscrição estadual</label>
            <input className="field" disabled={readOnly || v.ie_isento} value={v.inscricao_estadual} onChange={(e) => set("inscricao_estadual", e.target.value)} />
            <FieldError message={err("inscricao_estadual")} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <input type="checkbox" disabled={readOnly} checked={v.ie_isento} onChange={(e) => set("ie_isento", e.target.checked)} />
            Isento
          </label>
        </div>
      </section>

      <section className="card">
        <h2 className="mb-4 text-lg font-semibold text-brand-900">Endereço</h2>
        <div className="grid gap-4 md:grid-cols-6">
          {text("cep", "CEP", { className: "md:col-span-1" })}
          {text("logradouro", "Logradouro", { className: "md:col-span-3" })}
          {text("numero", "Número", { className: "md:col-span-1" })}
          {text("complemento", "Complemento", { className: "md:col-span-1" })}
          {text("bairro", "Bairro", { className: "md:col-span-2" })}
          {text("cidade", "Cidade", { className: "md:col-span-3" })}
          {text("uf", "UF", { className: "md:col-span-1" })}
        </div>
      </section>

      <section className="card">
        <h2 className="mb-1 text-lg font-semibold text-brand-900">Faturamento</h2>
        <p className="mb-4 text-sm text-slate-600">Preencha somente se o faturamento for emitido para um CNPJ diferente do cadastro.</p>
        <div className="grid gap-4 md:grid-cols-3">
          {text("billing_cnpj", "CNPJ de faturamento")}
          {text("billing_name", "Razão social do faturamento", { className: "md:col-span-2" })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-brand-900">Contatos</h2>
          {!readOnly && (
            <button type="button" className="btn-secondary" onClick={() => set("contacts", [...v.contacts, emptyContact()])}>
              + Contato
            </button>
          )}
        </div>
        {v.contacts.length === 0 && <p className="text-sm text-slate-500">Nenhum contato cadastrado.</p>}
        <div className="space-y-3">
          {v.contacts.map((c, i) => {
            const upd = (patch: Partial<Contact>) => set("contacts", v.contacts.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            return (
              <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
                <div className="md:col-span-3">
                  <label className="label">Nome *</label>
                  <input className="field" disabled={readOnly} value={c.name} onChange={(e) => upd({ name: e.target.value })} />
                  <FieldError message={err(`contacts.${i}.name`)} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Cargo</label>
                  <input className="field" disabled={readOnly} value={c.role_title ?? ""} onChange={(e) => upd({ role_title: e.target.value })} />
                </div>
                <div className="md:col-span-3">
                  <label className="label">E-mail</label>
                  <input className="field" type="email" disabled={readOnly} value={c.email ?? ""} onChange={(e) => upd({ email: e.target.value })} />
                  <FieldError message={err(`contacts.${i}.email`)} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Telefone</label>
                  <input className="field" disabled={readOnly} value={c.phone ?? ""} onChange={(e) => upd({ phone: e.target.value })} />
                </div>
                <div className="flex items-end justify-between gap-2 md:col-span-2">
                  <label className="flex items-center gap-1 pb-2 text-xs">
                    <input type="checkbox" disabled={readOnly} checked={c.is_primary} onChange={(e) => upd({ is_primary: e.target.checked })} /> Principal
                  </label>
                  {!readOnly && (
                    <button type="button" className="pb-2 text-xs text-red-600 hover:underline" onClick={() => set("contacts", v.contacts.filter((_, j) => j !== i))}>
                      Remover
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-brand-900">Unidades atendidas</h2>
            <p className="text-sm text-slate-600">Filiais, obras ou locais onde os serviços serão executados.</p>
          </div>
          {!readOnly && (
            <button type="button" className="btn-secondary" onClick={() => set("units", [...v.units, emptyUnit()])}>
              + Unidade
            </button>
          )}
        </div>
        {v.units.length === 0 && <p className="text-sm text-slate-500">Nenhuma unidade cadastrada.</p>}
        <div className="space-y-3">
          {v.units.map((u, i) => {
            const upd = (patch: Partial<Unit>) => set("units", v.units.map((x, j) => (j === i ? { ...x, ...patch } : x)));
            const f = (k: keyof Unit, label: string, cls: string) => (
              <div className={cls}>
                <label className="label">{label}</label>
                <input className="field" disabled={readOnly} value={String(u[k] ?? "")} onChange={(e) => upd({ [k]: e.target.value } as Partial<Unit>)} />
                <FieldError message={err(`units.${i}.${k}`)} />
              </div>
            );
            return (
              <div key={i} className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-12">
                {f("name", "Nome da unidade *", "md:col-span-4")}
                {f("cnpj", "CNPJ da unidade", "md:col-span-3")}
                {f("cep", "CEP", "md:col-span-2")}
                {f("logradouro", "Logradouro", "md:col-span-3")}
                {f("numero", "Nº", "md:col-span-1")}
                {f("bairro", "Bairro", "md:col-span-3")}
                {f("cidade", "Cidade", "md:col-span-3")}
                {f("uf", "UF", "md:col-span-1")}
                <div className="flex items-end md:col-span-2">
                  {!readOnly && (
                    <button type="button" className="pb-2 text-xs text-red-600 hover:underline" onClick={() => set("units", v.units.filter((_, j) => j !== i))}>
                      Remover unidade
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="card">
        <label className="label">Observações internas</label>
        <textarea className="field min-h-24" disabled={readOnly} value={v.notes} onChange={(e) => set("notes", e.target.value)} />
      </section>

      {!readOnly && (
        <div className="flex flex-wrap items-center gap-3">
          <button className="btn-primary" disabled={pending}>{pending ? "Salvando…" : "Salvar cadastro"}</button>
          {initial.id && (
            <button
              type="button"
              className="btn-secondary"
              disabled={pending}
              onClick={() =>
                start(async () => {
                  const r = await setClientActive(initial.id!, !initial.active);
                  if (!r.ok) setMessage({ tone: "error", text: r.error ?? "Erro." });
                  else router.refresh();
                })
              }
            >
              {initial.active ? "Inativar empresa" : "Reativar empresa"}
            </button>
          )}
        </div>
      )}
    </form>
  );
}
