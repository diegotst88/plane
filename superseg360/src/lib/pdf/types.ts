export interface ProposalItem {
  code: string;
  name: string;
  description: string;
  technical_scope: string;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  unit_label: string;
  quantity: number;
  unit_price_cents: number;
  discount_percent: number;
  total_cents: number;
}

export interface ProposalTexts {
  apresentacao: string;
  objeto: string;
  condicoes_pagamento: string;
  clausulas: string;
  aceite: string;
}

export interface ProposalData {
  number: number;
  version: number;
  issuedAt: string;
  validityDate: string;
  deliveryDays: number | null;
  subject: string;
  paymentTerms: string;
  subtotalCents: number;
  discountCents: number;
  totalCents: number;
  client: {
    razao_social: string;
    nome_fantasia: string | null;
    cnpj: string;
    inscricao_estadual: string | null;
    ie_isento: boolean;
    address: string;
    billing_cnpj: string | null;
    billing_name: string | null;
  };
  unit: { name: string; address: string } | null;
  contact: { name: string; role_title: string | null; email: string | null; phone: string | null } | null;
  items: ProposalItem[];
  texts: ProposalTexts;
  /** Verdadeiro quando algum modelo de texto ainda não foi aprovado: o PDF sai marcado como minuta. */
  draft: boolean;
  company: { name: string; cnpj: string; phone: string; email: string; site: string };
  responsible: string;
}
