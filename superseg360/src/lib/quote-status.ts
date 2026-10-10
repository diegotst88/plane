export type QuoteStatus = "elaboracao" | "enviada" | "aprovada" | "recusada";
export type QuoteDisplayStatus = QuoteStatus | "vencida";

export const STATUS_LABEL: Record<QuoteDisplayStatus, string> = {
  elaboracao: "Em elaboração",
  enviada: "Enviada",
  aprovada: "Aprovada",
  recusada: "Recusada",
  vencida: "Vencida",
};

export function todayISO(now: Date = new Date()): string {
  const tz = "America/Sao_Paulo";
  return new Intl.DateTimeFormat("sv-SE", { timeZone: tz }).format(now);
}

/** "Vencida" e derivada: proposta enviada, ainda sem resposta, cuja validade ja passou. */
export function displayStatus(
  status: QuoteStatus,
  validityDate: string,
  today: string = todayISO(),
): QuoteDisplayStatus {
  return status === "enviada" && validityDate < today ? "vencida" : status;
}

export function formatDateBR(iso: string | null | undefined): string {
  if (!iso) return "-";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}
