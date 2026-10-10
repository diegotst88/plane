import { describe, expect, it } from "vitest";
import { clientSchema, quoteSchema, serviceSchema } from "@/lib/schemas";

describe("schemas", () => {
  it("normaliza cliente e valida CNPJ", () => {
    const ok = clientSchema.safeParse({
      razao_social: "  Empresa X LTDA ",
      cnpj: "11.222.333/0001-81",
      cep: "80000-000",
      uf: "pr",
      contacts: [{ name: "Maria", email: "MARIA@X.COM" }],
    });
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.data.cnpj).toBe("11222333000181");
      expect(ok.data.cep).toBe("80000000");
      expect(ok.data.uf).toBe("PR");
      expect(ok.data.contacts[0]!.email).toBe("maria@x.com");
    }
    expect(clientSchema.safeParse({ razao_social: "X", cnpj: "123" }).success).toBe(false);
  });
  it("rejeita e-mail invalido e IE com isento", () => {
    expect(clientSchema.safeParse({ razao_social: "Empresa", cnpj: "11222333000181", contacts: [{ name: "Ana", email: "x" }] }).success).toBe(false);
    const r = clientSchema.parse({ razao_social: "Empresa", cnpj: "11222333000181", ie_isento: true, inscricao_estadual: "123" });
    expect(r.inscricao_estadual).toBeNull();
  });
  it("valida servico", () => {
    expect(serviceSchema.safeParse({ code: "pgr", name: "PGR", category: "programa", suggested_price_cents: 1000, delivery_days: null }).success).toBe(true);
    expect(serviceSchema.safeParse({ code: "p g", name: "PGR", category: "x", suggested_price_cents: -1, delivery_days: null }).success).toBe(false);
  });
  it("valida orcamento", () => {
    const base = {
      client_id: "5f0f7f3e-6b0a-4c6f-9d57-0d3a1c9a0a11",
      validity_date: "2026-11-01",
      delivery_days: 10,
      payment_terms: "30 dias",
      items: [{ code: "PGR", name: "PGR", quantity: 1, unit_price_cents: 1000, discount_percent: 0 }],
    };
    expect(quoteSchema.safeParse(base).success).toBe(true);
    expect(quoteSchema.safeParse({ ...base, items: [] }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...base, items: [{ ...base.items[0], quantity: 0 }] }).success).toBe(false);
    expect(quoteSchema.safeParse({ ...base, items: [{ ...base.items[0], discount_percent: 101 }] }).success).toBe(false);
  });
});
