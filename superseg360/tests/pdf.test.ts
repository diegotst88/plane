import { mkdirSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderProposalPdf } from "@/lib/pdf/render";
import { renderTemplate } from "@/lib/templates";
import { sampleProposal } from "./fixtures/proposal";

describe("proposta em PDF", () => {
  it("gera PDF valido a partir dos dados do orcamento (saida em sample-output/)", async () => {
    mkdirSync("sample-output", { recursive: true });
    const pdf = await renderProposalPdf(sampleProposal());
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(5000);
    writeFileSync("sample-output/proposta-exemplo.pdf", pdf);
    const draft = await renderProposalPdf({ ...sampleProposal(), draft: true });
    writeFileSync("sample-output/proposta-exemplo-minuta.pdf", draft);
  });

  it("substitui campos dos modelos e preserva desconhecidos", () => {
    expect(renderTemplate("Olá {{a}} e {{ b }} e {{x}}", { a: "1", b: "2" })).toBe("Olá 1 e 2 e {{x}}");
  });
});
