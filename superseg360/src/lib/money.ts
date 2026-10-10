const brl = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

export function formatBRL(cents: number | bigint | null | undefined): string {
  return brl.format(Number(cents ?? 0) / 100);
}

/** Converte "1.234,56", "1234.56" ou "R$ 10" em centavos inteiros. Retorna null se invalido. */
export function parseBRLToCents(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  let s = input.replace(/[R$\s]/g, "");
  if (s === "") return null;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  return Number(int) * 100 + Number(dec.padEnd(2, "0"));
}

export function centsToInput(cents: number | null | undefined): string {
  return ((cents ?? 0) / 100).toFixed(2).replace(".", ",");
}
