import type { AuditEntry } from "@/lib/types";

const TABLE_LABEL: Record<string, string> = {
  clients: "Empresa",
  client_units: "Unidade",
  client_contacts: "Contato",
  services: "Serviço",
  quotes: "Orçamento",
  quote_items: "Item do orçamento",
};
const ACTION_LABEL = { INSERT: "criou", UPDATE: "alterou", DELETE: "removeu" } as const;
const FIELD_LABEL: Record<string, string> = {
  razao_social: "razão social", nome_fantasia: "nome fantasia", cnpj: "CNPJ", inscricao_estadual: "inscrição estadual",
  ie_isento: "isento de IE", cep: "CEP", logradouro: "logradouro", numero: "número", complemento: "complemento",
  bairro: "bairro", cidade: "cidade", uf: "UF", billing_cnpj: "CNPJ de faturamento", billing_name: "razão social do faturamento",
  notes: "observações", active: "situação (ativo)", name: "nome", email: "e-mail", phone: "telefone", role_title: "cargo",
  is_primary: "principal", status: "status", validity_date: "validade", delivery_days: "prazo de entrega",
  payment_terms: "condições de pagamento", subject: "assunto", quantity: "quantidade", unit_price_cents: "valor unitário",
  discount_percent: "desconto", total_cents: "total", unit_id: "unidade", contact_id: "contato", client_id: "cliente",
};
const HIDDEN = new Set(["updated_by", "total_cents", "subtotal_cents", "discount_cents", "sent_at", "decided_at", "is_current", "template_snapshot"]);

export function AuditHistory({ entries }: { entries: AuditEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-slate-500">Sem alterações registradas.</p>;
  return (
    <ol className="space-y-2">
      {entries.map((e) => {
        const fields = (e.changed_fields ?? []).filter((f) => !HIDDEN.has(f)).map((f) => FIELD_LABEL[f] ?? f);
        return (
          <li key={e.id} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
            <span className="font-medium">{e.user_email ?? "sistema"}</span> {ACTION_LABEL[e.action]}{" "}
            <span className="font-medium">{TABLE_LABEL[e.table_name] ?? e.table_name}</span>
            {fields.length > 0 && <span className="text-slate-600">: {fields.join(", ")}</span>}
            <span className="block text-xs text-slate-500">
              {new Date(e.at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
