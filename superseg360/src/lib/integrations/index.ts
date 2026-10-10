/**
 * Preparação para integrações futuras (NÃO implementadas nesta fase).
 *
 * Como funciona:
 *  - Eventos de negócio (ex.: proposta criada/enviada/aprovada) são gravados automaticamente na
 *    tabela `integration_outbox` pelo banco de dados.
 *  - No futuro, um worker lê os eventos pendentes e entrega ao adaptador do provedor.
 *  - Mapeamento de IDs externos (ex.: cliente no Conta Azul) fica em `external_refs`.
 *  - Credenciais NUNCA são guardadas no banco: use variáveis de ambiente / Supabase Vault e grave
 *    apenas o nome da referência em `integration_connections.secret_ref`.
 */

export const INTEGRATION_PROVIDERS = ["conta_azul", "clickup", "soc", "whatsapp", "email", "zapsign", "ai_agents"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export interface OutboxEvent {
  id: number;
  event_type: string;
  entity_type: string;
  entity_id: string;
  payload: Record<string, unknown>;
}

export interface IntegrationAdapter {
  provider: IntegrationProvider;
  healthCheck(): Promise<{ ok: boolean; detail?: string }>;
  handleEvent(event: OutboxEvent): Promise<void>;
}

export const INTEGRATION_INFO: Record<IntegrationProvider, { label: string; purpose: string; secretEnv: string }> = {
  conta_azul: { label: "Conta Azul", purpose: "Faturamento e contas a receber a partir de propostas aprovadas.", secretEnv: "CONTA_AZUL_*" },
  clickup: { label: "ClickUp", purpose: "Criação de tarefas de execução quando a proposta for aprovada.", secretEnv: "CLICKUP_API_TOKEN" },
  soc: { label: "SOC", purpose: "Sincronização de clientes, unidades e exames ocupacionais.", secretEnv: "SOC_*" },
  whatsapp: { label: "WhatsApp", purpose: "Envio de propostas e lembretes de validade.", secretEnv: "WHATSAPP_*" },
  email: { label: "E-mail", purpose: "Envio automático da proposta em PDF ao cliente.", secretEnv: "SMTP_* / provedor de e-mail" },
  zapsign: { label: "ZapSign", purpose: "Assinatura eletrônica do aceite da proposta.", secretEnv: "ZAPSIGN_API_TOKEN" },
  ai_agents: { label: "Agentes de IA", purpose: "Assistentes para triagem, redação de escopo e acompanhamento comercial.", secretEnv: "AI_PROVIDER_*" },
};

/** Adaptadores registrados. Vazio de propósito: nenhuma integração é executada nesta fase. */
export const adapters: Partial<Record<IntegrationProvider, IntegrationAdapter>> = {};
