import { calcItem } from "../../src/lib/quote-calc";
import { buildTemplateVars, renderTemplate } from "../../src/lib/templates";
import type { ProposalData, ProposalItem } from "../../src/lib/pdf/types";

const raw = [
  { code: "PGR", name: "PGR - Programa de Gerenciamento de Riscos", description: "Identificação, avaliação e controle dos riscos ocupacionais, conforme NR-01.",
    technical_scope: "Levantamento preliminar de perigos e caracterização das exposições.\n\nInventário de riscos, plano de ação e elaboração do documento-base do PGR.",
    inclusions: "Visita técnica\nInventário de riscos\nPlano de ação", exclusions: "Medições quantitativas especiais\nImplantação das medidas de controle",
    specific_clauses: "O PGR terá vigência de 2 anos, com revisão anual.", unit_label: "un", quantity: 1, unit_price_cents: 280000, discount_percent: 5 },
  { code: "TREIN", name: "Treinamentos de SST", description: "Treinamentos obrigatórios de saúde e segurança do trabalho.",
    technical_scope: "Realização do treinamento conforme conteúdo programático da NR aplicável.", inclusions: "Instrutor\nMaterial didático\nCertificados",
    exclusions: "Deslocamento fora da região", specific_clauses: "", unit_label: "participante", quantity: 25, unit_price_cents: 9500, discount_percent: 0 },
];

export function sampleProposal(): ProposalData {
  const items: ProposalItem[] = raw.map((r) => ({
    ...r,
    total_cents: calcItem({ quantity: r.quantity, unitPriceCents: r.unit_price_cents, discountPercent: r.discount_percent }).totalCents,
  }));
  const subtotal = raw.reduce((a, r) => a + calcItem({ quantity: r.quantity, unitPriceCents: r.unit_price_cents, discountPercent: 0 }).totalCents, 0);
  const total = items.reduce((a, i) => a + i.total_cents, 0);
  const vars = buildTemplateVars({
    number: 38072, version: 1, validity_date: "2026-10-30", delivery_days: 20, payment_terms: "50% na assinatura e 50% na entrega, via boleto (28 dias)",
    total_cents: total, client: { razao_social: "Metalúrgica Alfa Indústria LTDA", nome_fantasia: "Alfa Metais", cnpj: "11222333000181" },
    unit: { name: "Matriz - Curitiba" }, items,
  });
  const t = (b: string) => renderTemplate(b, vars);
  return {
    number: 38072, version: 1, issuedAt: "2026-10-12", validityDate: "2026-10-30", deliveryDays: 20,
    subject: "Elaboração do PGR e treinamentos de SST", paymentTerms: vars.condicoes_pagamento!,
    subtotalCents: subtotal, discountCents: subtotal - total, totalCents: total,
    client: { razao_social: "Metalúrgica Alfa Indústria LTDA", nome_fantasia: "Alfa Metais", cnpj: "11222333000181", inscricao_estadual: "123.456.789", ie_isento: false,
      address: "Rua das Flores, 100, Centro, Curitiba/PR, CEP 80010-000", billing_cnpj: "45997418000153", billing_name: "Alfa Holding SA" },
    unit: { name: "Matriz - Curitiba", address: "Rua das Flores, 100" },
    contact: { name: "Maria Souza", role_title: "Gerente de RH", email: "maria@alfa.com.br", phone: "(41) 3000-1111" },
    items,
    texts: {
      apresentacao: t("A SuperSeg Medicina e Segurança do Trabalho atua na gestão integrada de saúde e segurança ocupacional.\n\nNossa equipe multidisciplinar desenvolve programas, laudos e treinamentos."),
      objeto: t("A presente proposta tem por objeto a prestação dos serviços de {{servicos_resumo}} a {{cliente_razao_social}}, CNPJ {{cliente_cnpj}}."),
      condicoes_pagamento: t("O investimento total desta proposta é de {{valor_total}}. Condições: {{condicoes_pagamento}}.\n\nValidade: {{validade}}. Prazo de entrega: {{prazo_entrega}}."),
      clausulas: t("1. DO OBJETO - Serviços descritos na proposta {{numero_proposta}}.\n\n2. DO FORO - Foro da comarca da sede da CONTRATADA."),
      aceite: t("O aceite poderá ser formalizado por assinatura, assinatura eletrônica ou e-mail citando {{numero_proposta}}."),
    },
    draft: false,
    company: { name: "SuperSeg Medicina e Segurança do Trabalho", cnpj: "", phone: "(41) 0000-0000", email: "comercial@superseg.com.br", site: "www.superseg.com.br" },
    responsible: "Departamento Comercial",
  };
}
