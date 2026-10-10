import { isValidCnpj, normalizeCnpj } from "@/lib/cnpj";

export interface CnpjPublicData {
  cnpj: string;
  razao_social: string;
  nome_fantasia: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  email: string | null;
  phone: string | null;
  situacao: string | null;
}

type Raw = Record<string, unknown>;
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

/** Converte a resposta da BrasilAPI (dados públicos da Receita Federal) para o formato do cadastro. */
export function mapBrasilApi(raw: Raw): CnpjPublicData {
  const ddd = str(raw.ddd_telefone_1);
  return {
    cnpj: normalizeCnpj(str(raw.cnpj) ?? ""),
    razao_social: str(raw.razao_social) ?? "",
    nome_fantasia: str(raw.nome_fantasia),
    cep: str(raw.cep)?.replace(/\D/g, "") ?? null,
    logradouro: [str(raw.descricao_tipo_de_logradouro), str(raw.logradouro)].filter(Boolean).join(" ") || null,
    numero: str(raw.numero),
    complemento: str(raw.complemento),
    bairro: str(raw.bairro),
    cidade: str(raw.municipio),
    uf: str(raw.uf),
    email: str(raw.email)?.toLowerCase() ?? null,
    phone: ddd,
    situacao: str(raw.descricao_situacao_cadastral),
  };
}

export type LookupResult =
  | { ok: true; data: CnpjPublicData }
  | { ok: false; error: string };

export async function lookupCnpj(
  value: string,
  fetchImpl: typeof fetch = fetch,
): Promise<LookupResult> {
  const cnpj = normalizeCnpj(value);
  if (!isValidCnpj(cnpj)) return { ok: false, error: "CNPJ inválido." };
  try {
    const res = await fetchImpl(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`, {
      signal: AbortSignal.timeout(8000),
      headers: { Accept: "application/json", "User-Agent": "SuperSeg360/1.0" },
      cache: "no-store",
    });
    if (res.status === 404) return { ok: false, error: "CNPJ não encontrado na base pública." };
    if (!res.ok) return { ok: false, error: "Serviço de consulta indisponível. Preencha manualmente." };
    return { ok: true, data: mapBrasilApi((await res.json()) as Raw) };
  } catch {
    return { ok: false, error: "Não foi possível consultar agora. Preencha manualmente." };
  }
}
