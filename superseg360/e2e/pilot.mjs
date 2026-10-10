// Teste de ponta a ponta do piloto comercial (Playwright). Requer o ambiente local rodando
// (scripts/local-stack) com banco recém-criado e os usuários admin/vendas. Uso: node e2e/pilot.mjs
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = "sample-output/e2e";
mkdirSync(OUT, { recursive: true });

const results = [];
let shot = 0;
const norm = (s) => s.replace(/\u00a0/g, " ");

async function step(name, fn) {
  try {
    await fn();
    results.push({ name, ok: true });
    console.log(`PASSOU  ${name}`);
  } catch (e) {
    results.push({ name, ok: false, error: String(e.message).split("\n")[0] });
    console.log(`FALHOU  ${name}\n        ${String(e.message).split("\n")[0]}`);
  }
}

const field = (page, label, scope) =>
  (scope ?? page).locator(`xpath=.//label[normalize-space()="${label}"]/following::*[self::input or self::textarea or self::select][1]`).first();

async function bodyText(page) {
  return norm(await page.locator("body").innerText());
}
async function expectBody(page, text, timeout = 8000) {
  const start = Date.now();
  for (;;) {
    const t = await bodyText(page);
    if (t.includes(text)) return;
    if (Date.now() - start > timeout) throw new Error(`Texto não encontrado: "${text}"`);
    await page.waitForTimeout(150);
  }
}
async function snap(page, name) {
  await page.screenshot({ path: `${OUT}/${String(++shot).padStart(2, "0")}-${name}.png`, fullPage: true });
}
async function login(page, email, password) {
  await page.context().clearCookies();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL("**/dashboard"), page.click("button:has-text('Entrar')")]);
}
async function selectContaining(select, text) {
  const value = await select.evaluate((el, t) => [...el.options].find((o) => o.textContent.includes(t))?.value, text);
  if (!value) throw new Error(`Opção contendo "${text}" não encontrada`);
  await select.selectOption(value);
}

const ADMIN = ["admin@superseg.test", "Senha-Admin-123"];
const VENDAS = ["vendas@superseg.test", "Senha-Vendas-123"];

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: "pt-BR" });
const page = await ctx.newPage();
page.on("pageerror", (e) => console.log("  [pageerror]", e.message));

await step("Acesso sem login redireciona para /login; senha errada é recusada", async () => {
  await page.goto(`${BASE}/clientes`);
  await page.waitForURL("**/login**");
  await page.fill("#email", ADMIN[0]);
  await page.fill("#password", "errada");
  await page.click("button:has-text('Entrar')");
  await expectBody(page, "E-mail ou senha incorretos.");
});

await step("Admin edita serviço PGR (preço, prazo, escopo) e persiste", async () => {
  await login(page, ...ADMIN);
  await page.goto(`${BASE}/servicos`);
  await page.click("a:has-text('PGR - Programa')");
  await page.waitForSelector("button:has-text('Salvar serviço')");
  await field(page, "Preço sugerido (R$)").fill("2.800,00");
  await field(page, "Prazo de entrega (dias)").fill("20");
  await field(page, "Escopo técnico").fill("Levantamento de perigos.\nInventário de riscos e plano de ação.");
  await field(page, "O que está incluso").fill("Visita técnica\nPlano de ação");
  await page.click("button:has-text('Salvar serviço')");
  await expectBody(page, "Serviço salvo.");
  await page.reload();
  const v = await field(page, "Preço sugerido (R$)").inputValue();
  if (v !== "2800,00") throw new Error(`Preço persistido incorreto: ${v}`);
  await expectBody(page, "Histórico de alterações");
  await snap(page, "servico-pgr");
});

await step("Admin define preço do TREIN e cria serviço novo; código duplicado é recusado", async () => {
  await page.goto(`${BASE}/servicos`);
  await page.click("a:has-text('Treinamentos de SST')");
  await field(page, "Preço sugerido (R$)").fill("95,00");
  await page.click("button:has-text('Salvar serviço')");
  await expectBody(page, "Serviço salvo.");
  for (const attempt of [1, 2]) {
    await page.goto(`${BASE}/servicos/novo`);
    await field(page, "Código *").fill("TESTE1");
    await field(page, "Nome do serviço *").fill("Serviço de teste");
    await page.click("button:has-text('Salvar serviço')");
    if (attempt === 1) await page.waitForURL(/\/servicos\/[0-9a-f-]{36}/);
    else await expectBody(page, "Já existe um serviço com este código.");
  }
});

await step("Cadastro de cliente com consulta pública de CNPJ (Buscar) e salvamento", async () => {
  await page.goto(`${BASE}/clientes/novo`);
  await field(page, "CNPJ *").fill("00.000.000/0001-91");
  await page.click("button:has-text('Buscar')");
  await page.waitForFunction(() => [...document.querySelectorAll("input")].some((i) => /BANCO DO BRASIL/i.test(i.value)), null, { timeout: 15000 }).catch(() => {
    throw new Error("Consulta pública não preencheu a razão social (rede/BrasilAPI indisponível?)");
  });
  await snap(page, "cliente-busca-cnpj");
  await page.click("button:has-text('+ Unidade')");
  await page.locator("xpath=//label[normalize-space()='Nome da unidade *']/following-sibling::input").fill("Matriz");
  await page.click("button:has-text('Salvar cadastro')");
  await page.waitForURL(/\/clientes\/[0-9a-f-]{36}/);
  await expectBody(page, "Propostas deste cliente");
});

await step("CNPJ duplicado e CNPJ inválido são recusados", async () => {
  await page.goto(`${BASE}/clientes/novo`);
  await field(page, "CNPJ *").fill("00000000000191");
  await field(page, "Razão social *").fill("Duplicada SA");
  await page.click("button:has-text('Salvar cadastro')");
  await expectBody(page, "Já existe uma empresa com este CNPJ");
  await field(page, "CNPJ *").fill("11.222.333/0001-82");
  await page.click("button:has-text('Salvar cadastro')");
  await expectBody(page, "CNPJ inválido");
});

let quoteUrl = "";
await step("Comercial cria orçamento: totais automáticos e limite de desconto", async () => {
  await login(page, ...VENDAS);
  await page.goto(`${BASE}/orcamentos/novo`);
  await selectContaining(field(page, "Cliente *"), "BANCO DO BRASIL");
  await page.waitForTimeout(800);
  await page.locator("select[aria-label='Serviço a adicionar']").selectOption({ label: "PGR · PGR - Programa de Gerenciamento de Riscos" });
  await page.click("button:has-text('Adicionar')");
  await page.locator("select[aria-label='Serviço a adicionar']").selectOption({ label: "TREIN · Treinamentos de SST" });
  await page.click("button:has-text('Adicionar')");
  const rows = page.locator("div.rounded-lg.border.border-slate-200.p-3");
  const qty = (i) => rows.nth(i).locator("xpath=.//label[starts-with(normalize-space(),'Quantidade')]/following-sibling::input");
  const disc = (i) => rows.nth(i).locator("xpath=.//label[normalize-space()='Desc. %']/following-sibling::input");
  await qty(0).fill("2");
  await qty(1).fill("10");
  await disc(1).fill("5");
  await expectBody(page, "R$ 6.502,50");
  await disc(1).fill("6");
  await page.fill("textarea[required]", "À vista");
  await page.click("button:has-text('Salvar orçamento')");
  await expectBody(page, "acima do limite autorizado (5%)");
  await disc(1).fill("5");
  await page.click("button:has-text('Salvar orçamento')");
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  quoteUrl = page.url();
  await page.reload();
  await expectBody(page, "Proposta #1 · versão 1");
  await expectBody(page, "R$ 6.502,50");
  await snap(page, "orcamento-salvo");
});

await step("PDF em minuta (modelos não aprovados) e envio bloqueado", async () => {
  const id = quoteUrl.split("/").pop();
  const res = await ctx.request.get(`${BASE}/api/propostas/${id}/pdf`);
  if (res.status() !== 200) throw new Error(`PDF status ${res.status()}`);
  const disp = res.headers()["content-disposition"] ?? "";
  if (!disp.includes("MINUTA")) throw new Error(`Esperava marca de minuta no nome do arquivo: ${disp}`);
  writeFileSync(`${OUT}/proposta-minuta.pdf`, await res.body());
  await page.click("button:has-text('Marcar como enviada…')");
  await page.click("button:has-text('Sim, marcar como enviada')");
  await expectBody(page, "ainda não aprovados por um administrador");
  await snap(page, "envio-bloqueado");
});

await step("Admin aprova os 5 modelos de texto", async () => {
  await login(page, ...ADMIN);
  await page.goto(`${BASE}/modelos`);
  const sections = page.locator("section.card");
  const total = await sections.count();
  for (let i = 0; i < total; i++) {
    const sec = sections.nth(i);
    const title = sec.locator("input[aria-label='Título']");
    const body = sec.locator("textarea[aria-label='Texto']");
    if (/provis/i.test(await title.inputValue()) || /\[(TEXTO|MINUTA) PROVIS/i.test(await body.inputValue())) {
      await sec.locator("button:has-text('Aprovar este texto…')").click();
      await sec.locator("button:has-text('Sim, aprovar')").click();
      await expectBody(page, "marcações provisórias");
      await title.fill((await title.inputValue()).replace(/\s*\(MINUTA[^)]*\)/i, ""));
      await body.fill((await body.inputValue()).split("\n").filter((l) => !/\[(TEXTO|MINUTA) PROVIS/i.test(l)).join("\n").trim());
      await sec.locator("button:has-text('Salvar rascunho')").click();
      await expectBody(page, "Rascunho salvo.");
      await page.reload();
    }
  }
  for (let i = 0; i < 5; i++) {
    await page.locator("button:has-text('Aprovar este texto…')").first().click();
    await page.locator("button:has-text('Sim, aprovar')").first().click();
    await expectBody(page, `Vigente: versão 1`);
    await page.waitForFunction((n) => document.querySelectorAll("button").length > 0 && [...document.querySelectorAll("button")].filter((b) => b.textContent.includes("Aprovar este texto")).length === n, 4 - i, { timeout: 8000 });
  }
  await snap(page, "modelos-aprovados");
});

await step("Rascunho de nova versão de texto não altera o texto vigente", async () => {
  await page.goto(`${BASE}/modelos`);
  const section = page.locator("section", { hasText: "Formas de aceite" }).first();
  await section.locator("button:has-text('Criar nova versão (rascunho)')").click();
  await expectBody(page, "Rascunho: versão 2");
  await expectBody(page, "Vigente: versão 1");
});

await step("Comercial: PDF sem minuta, envia, orçamento trava, registra recusa", async () => {
  await login(page, ...VENDAS);
  await page.goto(quoteUrl);
  const id = quoteUrl.split("/").pop();
  const res = await ctx.request.get(`${BASE}/api/propostas/${id}/pdf`);
  const disp = res.headers()["content-disposition"] ?? "";
  if (disp.includes("MINUTA")) throw new Error(`PDF ainda como minuta: ${disp}`);
  writeFileSync(`${OUT}/proposta-final.pdf`, await res.body());
  await page.click("button:has-text('Marcar como enviada…')");
  await page.click("button:has-text('Sim, marcar como enviada')");
  await expectBody(page, "Enviada");
  if ((await page.locator("button:has-text('Salvar orçamento')").count()) !== 0) throw new Error("Editor ainda visível após envio");
  await page.fill("input[placeholder^='Observação']", "Preço alto");
  await page.click("button:has-text('Proposta recusada')");
  await expectBody(page, "Recusada");
  await snap(page, "orcamento-recusado");
});

await step("Nova versão após decisão preserva histórico", async () => {
  await page.click("button:has-text('Criar nova versão')");
  await page.waitForURL(/\/orcamentos\/[0-9a-f-]{36}/);
  await expectBody(page, "versão 2");
  await expectBody(page, "Salvar orçamento");
  await expectBody(page, "Versão 1");
});

await step("Painel, filtros e busca de orçamentos", async () => {
  await page.goto(`${BASE}/dashboard`);
  await expectBody(page, "Propostas em elaboração");
  const cards = norm(await page.locator("a.card").allInnerTexts().then((t) => t.join("|")).then((s) => s.replace(/\n/g, " ")));
  console.log("        cartões:", cards);
  await snap(page, "painel");
  await page.goto(`${BASE}/orcamentos?q=banco`);
  await expectBody(page, "#1 v2");
  await page.goto(`${BASE}/orcamentos?q=1`);
  await expectBody(page, "#1 v2");
  await page.goto(`${BASE}/orcamentos?status=elaboracao`);
  await expectBody(page, "#1 v2");
});

await step("Comercial não acessa Modelos/Usuários/Integrações e não vê botão de novo serviço", async () => {
  for (const p of ["/modelos", "/usuarios", "/integracoes"]) {
    await page.goto(`${BASE}${p}`);
    await page.waitForURL("**/acesso-negado");
  }
  await page.goto(`${BASE}/servicos`);
  if ((await page.locator("a:has-text('Novo serviço')").count()) !== 0) throw new Error("Botão Novo serviço visível");
});

await step("Admin cria usuário pelo sistema e novo usuário consegue entrar", async () => {
  await login(page, ...ADMIN);
  await page.goto(`${BASE}/usuarios`);
  await field(page, "Nome").fill("Teste Piloto");
  await field(page, "E-mail").fill("teste.piloto@superseg.test");
  await field(page, "Senha temporária").fill("Piloto-Teste-2026");
  await page.click("button:has-text('Criar usuário')");
  await expectBody(page, "Usuário criado");
  await login(page, "teste.piloto@superseg.test", "Piloto-Teste-2026");
  await expectBody(page, "Painel comercial");
});

await browser.close();
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passos OK`);
writeFileSync(`${OUT}/resultado.json`, JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
