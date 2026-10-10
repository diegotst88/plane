import { TEMPLATE_KEYS, type TemplateKey } from "@/lib/templates";

export interface TemplateRow {
  id: string;
  key: string;
  body: string;
  version: number;
  status: "draft" | "approved" | "archived";
}

export interface TemplateSelection {
  byKey: Partial<Record<TemplateKey, TemplateRow>>;
  /** Chaves sem nenhuma versão aprovada (o PDF sai como minuta e o envio é bloqueado). */
  pendingKeys: TemplateKey[];
}

/**
 * Escolhe o texto de cada modelo. Propostas já enviadas usam exatamente as versões registradas
 * no momento do envio (snapshot); as demais usam a versão aprovada vigente, ou o rascunho mais
 * recente quando ainda não há aprovação.
 */
export function selectTemplates(
  rows: TemplateRow[],
  snapshot: Record<string, string> | null,
): TemplateSelection {
  const byKey: TemplateSelection["byKey"] = {};
  const pendingKeys: TemplateKey[] = [];
  for (const key of TEMPLATE_KEYS) {
    const candidates = rows.filter((r) => r.key === key);
    const snapId = snapshot?.[key];
    const pinned = snapId ? candidates.find((r) => r.id === snapId) : undefined;
    const approved = candidates.find((r) => r.status === "approved");
    const latest = [...candidates].sort((a, b) => b.version - a.version)[0];
    const chosen = pinned ?? approved ?? latest;
    if (chosen) byKey[key] = chosen;
    if (!chosen || chosen.status === "draft") pendingKeys.push(key);
  }
  return { byKey, pendingKeys };
}

export function snapshotOf(selection: TemplateSelection): Record<string, string> {
  return Object.fromEntries(Object.entries(selection.byKey).map(([k, v]) => [k, v!.id]));
}
