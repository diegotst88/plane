import { z } from "zod";
import { isValidCnpj, normalizeCnpj, normalizeDigits } from "@/lib/cnpj";

const text = (max = 500) =>
  z
    .string()
    .trim()
    .max(max, `Máximo de ${max} caracteres`)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional()
    .transform((v) => v ?? null);

const longText = (max = 8000) => z.string().trim().max(max, `Máximo de ${max} caracteres`).default("");

const cnpjRequired = z
  .string()
  .transform(normalizeCnpj)
  .refine(isValidCnpj, "CNPJ inválido");

const cnpjOptional = z
  .string()
  .nullable()
  .optional()
  .transform((v) => normalizeCnpj(v))
  .refine((v) => v === "" || isValidCnpj(v), "CNPJ inválido")
  .transform((v) => (v === "" ? null : v));

const cep = z
  .string()
  .nullable()
  .optional()
  .transform((v) => normalizeDigits(v))
  .refine((v) => v === "" || v.length === 8, "CEP deve ter 8 dígitos")
  .transform((v) => (v === "" ? null : v));

const uf = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ?? "").trim().toUpperCase())
  .refine((v) => v === "" || /^[A-Z]{2}$/.test(v), "UF inválida")
  .transform((v) => (v === "" ? null : v));

const email = z
  .string()
  .trim()
  .nullable()
  .optional()
  .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), "E-mail inválido")
  .transform((v) => (v ? v.toLowerCase() : null));

const uuidOptional = z
  .string()
  .nullable()
  .optional()
  .transform((v) => (v ? v : null))
  .refine((v) => v === null || z.uuid().safeParse(v).success, "Identificador inválido");

export const contactSchema = z.object({
  id: uuidOptional,
  name: z.string().trim().min(2, "Informe o nome do contato").max(200),
  role_title: text(120),
  email,
  phone: text(40),
  is_primary: z.boolean().default(false),
});

export const unitSchema = z.object({
  id: uuidOptional,
  name: z.string().trim().min(2, "Informe o nome da unidade").max(200),
  cnpj: cnpjOptional,
  cep,
  logradouro: text(200),
  numero: text(20),
  complemento: text(120),
  bairro: text(120),
  cidade: text(120),
  uf,
});

export const clientSchema = z
  .object({
    razao_social: z.string().trim().min(2, "Informe a razão social").max(250),
    nome_fantasia: text(250),
    cnpj: cnpjRequired,
    inscricao_estadual: text(30),
    ie_isento: z.boolean().default(false),
    cep,
    logradouro: text(200),
    numero: text(20),
    complemento: text(120),
    bairro: text(120),
    cidade: text(120),
    uf,
    billing_cnpj: cnpjOptional,
    billing_name: text(250),
    notes: text(4000),
    contacts: z.array(contactSchema).max(50).default([]),
    units: z.array(unitSchema).max(200).default([]),
  })
  .transform((v) => ({ ...v, inscricao_estadual: v.ie_isento ? null : v.inscricao_estadual }));

export type ClientInput = z.input<typeof clientSchema>;
export type ClientData = z.output<typeof clientSchema>;

export const serviceSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9_-]{1,29}$/, "Use 2 a 30 caracteres: letras, números, - ou _"),
  name: z.string().trim().min(2, "Informe o nome do serviço").max(250),
  category: z.enum(["programa", "laudo", "norma", "ergonomia", "treinamento", "exame", "outros"]),
  commercial_description: longText(),
  technical_scope: longText(),
  suggested_price_cents: z.number().int().min(0, "Preço inválido"),
  unit_label: z.string().trim().min(1, "Informe a unidade").max(40).default("un"),
  delivery_days: z.number().int().min(0).max(3650).nullable(),
  inclusions: longText(),
  exclusions: longText(),
  specific_clauses: longText(),
  active: z.boolean().default(true),
});
export type ServiceInput = z.input<typeof serviceSchema>;

export const quoteItemSchema = z.object({
  service_id: uuidOptional,
  code: z.string().trim().min(1).max(30),
  name: z.string().trim().min(1, "Informe o nome do item").max(250),
  description: longText(),
  technical_scope: longText(),
  inclusions: longText(),
  exclusions: longText(),
  specific_clauses: longText(),
  unit_label: z.string().trim().min(1).max(40).default("un"),
  quantity: z
    .number()
    .positive("Quantidade deve ser maior que zero")
    .max(1_000_000)
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use no máximo 2 casas decimais"),
  unit_price_cents: z.number().int().min(0, "Valor inválido").max(100_000_000_000),
  discount_percent: z
    .number()
    .min(0, "Desconto inválido")
    .max(100, "Desconto inválido")
    .refine((n) => Math.abs(n * 100 - Math.round(n * 100)) < 1e-6, "Use no máximo 2 casas decimais"),
});

export const quoteSchema = z.object({
  client_id: z.uuid("Selecione o cliente"),
  unit_id: uuidOptional,
  contact_id: uuidOptional,
  subject: z.string().trim().max(500).default(""),
  validity_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe a validade"),
  delivery_days: z.number().int().min(0).max(3650).nullable(),
  payment_terms: z.string().trim().min(1, "Informe as condições de pagamento").max(2000),
  internal_notes: z.string().trim().max(4000).default(""),
  items: z.array(quoteItemSchema).min(1, "Adicione ao menos um serviço").max(100),
});
export type QuoteInput = z.input<typeof quoteSchema>;
export type QuoteData = z.output<typeof quoteSchema>;

export const templateSchema = z.object({
  title: z.string().trim().min(2).max(250),
  body: z.string().trim().min(1, "O texto não pode ficar vazio").max(30000),
});
