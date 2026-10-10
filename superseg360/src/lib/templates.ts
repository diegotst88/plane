import { formatCnpj } from "@/lib/cnpj";
import { formatBRL } from "@/lib/money";
import { formatDateBR } from "@/lib/quote-status";

export const TEMPLATE_KEYS = [
  "apresentacao_superseg",
  "objeto_proposta",
  "condicoes_pagamento",
  "clausulas_contratuais",
  "formas_aceite",
] as const;
export type TemplateKey = (typeof TEMPLATE_KEYS)[number];

export const TEMPLATE_VARIABLES: { name: string; description: string }[] = [
  { name: "cliente_razao_social", description: "Razão social do cliente" },
  { name: "cliente_nome_fantasia", description: "Nome fantasia do cliente" },
  { name: "cliente_cnpj", description: "CNPJ do cliente" },
  { name: "unidade_nome", description: "Unidade atendida" },
  { name: "numero_proposta", description: "Número/versão da proposta (ex.: 12/1)" },
  { name: "validade", description: "Data de validade" },
  { name: "prazo_entrega", description: "Prazo de entrega" },
  { name: "valor_total", description: "Valor total da proposta" },
  { name: "servicos_resumo", description: "Lista resumida dos serviços" },
  { name: "condicoes_pagamento", description: "Condições de pagamento do orçamento" },
];

export type TemplateVars = Record<string, string>;

/** Substitui {{campo}} pelos dados do orçamento. Campos desconhecidos permanecem visíveis para revisão. */
export function renderTemplate(body: string, vars: TemplateVars): string {
  return body.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? (vars[name] as string) : match,
  );
}

export function joinList(items: string[]): string {
  if (items.length <= 1) return items.join("");
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export interface VarsSource {
  number: number;
  version: number;
  validity_date: string;
  delivery_days: number | null;
  payment_terms: string;
  total_cents: number;
  client: { razao_social: string; nome_fantasia: string | null; cnpj: string };
  unit: { name: string } | null;
  items: { name: string }[];
}

export function buildTemplateVars(src: VarsSource): TemplateVars {
  return {
    cliente_razao_social: src.client.razao_social,
    cliente_nome_fantasia: src.client.nome_fantasia ?? src.client.razao_social,
    cliente_cnpj: formatCnpj(src.client.cnpj),
    unidade_nome: src.unit?.name ?? "todas as unidades",
    numero_proposta: `${src.number}/${src.version}`,
    validade: formatDateBR(src.validity_date),
    prazo_entrega: src.delivery_days === null ? "a combinar" : `${src.delivery_days} dias`,
    valor_total: formatBRL(src.total_cents),
    servicos_resumo: joinList([...new Set(src.items.map((i) => i.name))]),
    condicoes_pagamento: src.payment_terms,
  };
}
