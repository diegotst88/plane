import type { QuoteStatus } from "@/lib/quote-status";

export type AppRole = "admin" | "comercial" | "leitura";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: AppRole;
  active: boolean;
  max_discount_percent: number;
}

export interface Client {
  id: string;
  razao_social: string;
  nome_fantasia: string | null;
  cnpj: string;
  inscricao_estadual: string | null;
  ie_isento: boolean;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  billing_cnpj: string | null;
  billing_name: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ClientUnit {
  id: string;
  client_id: string;
  name: string;
  cnpj: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  active: boolean;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  role_title: string | null;
  email: string | null;
  phone: string | null;
  is_primary: boolean;
  active: boolean;
}

export interface Service {
  id: string;
  code: string;
  name: string;
  category: string;
  commercial_description: string;
  technical_scope: string;
  suggested_price_cents: number;
  unit_label: string;
  delivery_days: number | null;
  inclusions: string;
  exclusions: string;
  specific_clauses: string;
  active: boolean;
}

export interface Quote {
  id: string;
  number: number;
  version: number;
  is_current: boolean;
  status: QuoteStatus;
  client_id: string;
  unit_id: string | null;
  contact_id: string | null;
  subject: string;
  validity_date: string;
  delivery_days: number | null;
  payment_terms: string;
  internal_notes: string;
  subtotal_cents: number;
  discount_cents: number;
  total_cents: number;
  sent_at: string | null;
  decided_at: string | null;
  decision_note: string | null;
  template_snapshot: Record<string, number> | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteItem {
  id: string;
  quote_id: string;
  service_id: string | null;
  position: number;
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

export interface DocumentTemplate {
  id: string;
  key: string;
  kind: "institutional" | "contractual";
  title: string;
  body: string;
  version: number;
  status: "draft" | "approved" | "archived";
  approved_at: string | null;
  created_at: string;
}

export interface AuditEntry {
  id: number;
  at: string;
  user_email: string | null;
  table_name: string;
  action: "INSERT" | "UPDATE" | "DELETE";
  changed_fields: string[] | null;
  old_data: Record<string, unknown> | null;
  new_data: Record<string, unknown> | null;
}
