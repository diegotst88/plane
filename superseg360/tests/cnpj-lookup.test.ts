import { describe, expect, it } from "vitest";
import { lookupCnpj, mapBrasilApi } from "@/lib/cnpj-lookup";

describe("consulta publica de CNPJ", () => {
  it("mapeia resposta da BrasilAPI", () => {
    const d = mapBrasilApi({
      cnpj: "11222333000181", razao_social: "EMPRESA X LTDA", nome_fantasia: "", cep: "80010000",
      descricao_tipo_de_logradouro: "RUA", logradouro: "DAS FLORES", numero: "10", municipio: "CURITIBA", uf: "PR",
      email: "CONTATO@X.COM", ddd_telefone_1: "4130001111", descricao_situacao_cadastral: "ATIVA",
    });
    expect(d).toMatchObject({ razao_social: "EMPRESA X LTDA", nome_fantasia: null, logradouro: "RUA DAS FLORES", email: "contato@x.com", uf: "PR" });
  });
  it("trata erros sem lançar", async () => {
    expect((await lookupCnpj("123")).ok).toBe(false);
    const notFound = await lookupCnpj("11222333000181", (async () => new Response("{}", { status: 404 })) as typeof fetch);
    expect(notFound).toEqual({ ok: false, error: "CNPJ não encontrado na base pública." });
    const down = await lookupCnpj("11222333000181", (async () => { throw new Error("rede"); }) as typeof fetch);
    expect(down.ok).toBe(false);
    const ok = await lookupCnpj("11222333000181", (async () => Response.json({ razao_social: "A", cnpj: "11222333000181" })) as typeof fetch);
    expect(ok.ok).toBe(true);
  });
});
