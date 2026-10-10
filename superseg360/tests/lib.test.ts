import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, normalizeCnpj } from "@/lib/cnpj";
import { formatBRL, parseBRLToCents } from "@/lib/money";
import { calcItem, calcQuote } from "@/lib/quote-calc";
import { displayStatus } from "@/lib/quote-status";

describe("cnpj", () => {
  it("valida CNPJ numerico e alfanumerico", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("12.ABC.345/01DE-35")).toBe(true);
    expect(isValidCnpj("11.222.333/0001-82")).toBe(false);
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("123")).toBe(false);
  });
  it("normaliza e formata", () => {
    expect(normalizeCnpj("11.222.333/0001-81")).toBe("11222333000181");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });
});

describe("money", () => {
  it("converte textos para centavos", () => {
    expect(parseBRLToCents("1.234,56")).toBe(123456);
    expect(parseBRLToCents("R$ 10")).toBe(1000);
    expect(parseBRLToCents("10,5")).toBe(1050);
    expect(parseBRLToCents("1234.56")).toBe(123456);
    expect(parseBRLToCents("abc")).toBeNull();
    expect(parseBRLToCents("")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatBRL(123456).replace(/\s/g, " ")).toBe("R$ 1.234,56");
  });
});

describe("calculo de orcamento", () => {
  it("calcula item sem desconto", () => {
    expect(calcItem({ quantity: 3, unitPriceCents: 15000, discountPercent: 0 })).toEqual({
      grossCents: 45000,
      totalCents: 45000,
    });
  });
  it("aplica desconto percentual com arredondamento meio para cima", () => {
    expect(calcItem({ quantity: 1, unitPriceCents: 999, discountPercent: 5 }).totalCents).toBe(949); // 949.05
    expect(calcItem({ quantity: 1, unitPriceCents: 10, discountPercent: 5 }).totalCents).toBe(10); // 9.5 -> 10
    expect(calcItem({ quantity: 2.5, unitPriceCents: 12345, discountPercent: 12.5 }).totalCents).toBe(27005);
  });
  it("totaliza itens", () => {
    const t = calcQuote([
      { quantity: 1, unitPriceCents: 100000, discountPercent: 10 },
      { quantity: 10, unitPriceCents: 5000, discountPercent: 0 },
    ]);
    expect(t).toEqual({ subtotalCents: 150000, discountCents: 10000, totalCents: 140000 });
  });
});

describe("status", () => {
  it("deriva vencida somente de enviada", () => {
    expect(displayStatus("enviada", "2026-10-01", "2026-10-10")).toBe("vencida");
    expect(displayStatus("enviada", "2026-10-10", "2026-10-10")).toBe("enviada");
    expect(displayStatus("aprovada", "2026-10-01", "2026-10-10")).toBe("aprovada");
    expect(displayStatus("elaboracao", "2026-10-01", "2026-10-10")).toBe("elaboracao");
  });
});
