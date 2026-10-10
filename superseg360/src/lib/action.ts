export interface ActionResult<T = undefined> {
  ok: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  data?: T;
}

export function fail<T = never>(error: string, fieldErrors?: Record<string, string>): ActionResult<T> {
  return { ok: false, error, fieldErrors };
}

/** Traduz erros comuns do PostgreSQL/Supabase para mensagens claras ao usuário. */
export function dbErrorMessage(err: { message: string; code?: string } | null | undefined): string {
  if (!err) return "Erro desconhecido.";
  const m = err.message;
  if (err.code === "23505" || m.includes("duplicate key")) {
    if (m.includes("clients_cnpj_key")) return "Já existe uma empresa cadastrada com este CNPJ.";
    if (m.includes("services_code_key")) return "Já existe um serviço com este código.";
    return "Registro duplicado.";
  }
  if (err.code === "42501" || m.includes("row-level security") || m.includes("permission denied"))
    return "Você não tem permissão para realizar esta operação.";
  if (err.code === "23514") return "Algum dado informado é inválido (verifique CNPJ, e-mail, valores e datas).";
  if (err.code === "P0001") return m;
  return "Não foi possível concluir a operação. Tente novamente.";
}

export function zodFieldErrors(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = i.path.map(String).join(".");
    if (!(key in out)) out[key] = i.message;
  }
  return out;
}
