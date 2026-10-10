const WEIGHTS_1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const WEIGHTS_2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];

export function normalizeCnpj(value: string | null | undefined): string {
  return (value ?? "").toUpperCase().replace(/[^0-9A-Z]/g, "");
}

function charValue(ch: string): number {
  return ch.charCodeAt(0) - 48;
}

function checkDigit(base: string, weights: number[]): number {
  let sum = 0;
  for (let i = 0; i < weights.length; i++) sum += charValue(base[i]!) * weights[i]!;
  const rest = sum % 11;
  return rest < 2 ? 0 : 11 - rest;
}

/** Valida CNPJ numerico ou alfanumerico (padrao em vigor desde jul/2026). */
export function isValidCnpj(value: string | null | undefined): boolean {
  const cnpj = normalizeCnpj(value);
  if (!/^[0-9A-Z]{12}[0-9]{2}$/.test(cnpj)) return false;
  if (/^(.)\1{13}$/.test(cnpj)) return false;
  const d1 = checkDigit(cnpj.slice(0, 12), WEIGHTS_1);
  if (d1 !== charValue(cnpj[12]!)) return false;
  const d2 = checkDigit(cnpj.slice(0, 13), WEIGHTS_2);
  return d2 === charValue(cnpj[13]!);
}

export function formatCnpj(value: string | null | undefined): string {
  const c = normalizeCnpj(value);
  if (c.length !== 14) return value ?? "";
  return `${c.slice(0, 2)}.${c.slice(2, 5)}.${c.slice(5, 8)}/${c.slice(8, 12)}-${c.slice(12)}`;
}

export function normalizeDigits(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

export function formatCep(value: string | null | undefined): string {
  const d = normalizeDigits(value);
  return d.length === 8 ? `${d.slice(0, 5)}-${d.slice(5)}` : (value ?? "");
}
