import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calcItem } from "@/lib/quote-calc";
import { asUser, createDb, createUser, expectError } from "./harness";

const CNPJ_A = "11222333000181";
const CNPJ_B = "12ABC34501DE35";

let db: PGlite;
let admin: string;
let comercial: string;
let leitura: string;
let inativo: string;

const q = <T extends object = Record<string, unknown>>(sql: string, params: unknown[] = []) =>
  db.query<T>(sql, params);

beforeAll(async () => {
  db = await createDb();
  admin = await createUser(db, "admin@superseg.com.br");
  comercial = await createUser(db, "vendas@superseg.com.br");
  leitura = await createUser(db, "leitura@superseg.com.br");
  inativo = await createUser(db, "saiu@superseg.com.br");
  await q("update public.profiles set role='comercial' where id=$1", [comercial]);
  await q("update public.profiles set active=false where id=$1", [inativo]);
  await q("update public.profiles set role='comercial' where id=$1", [inativo]);
});
afterAll(async () => db.close());

async function insertClient(user: string, cnpj: string, name = "Empresa Teste LTDA") {
  return asUser(db, user, async () => {
    const r = await q<{ id: string }>(
      "insert into public.clients (razao_social, cnpj, created_by) values ($1,$2,$3) returning id",
      [name, cnpj, user],
    );
    return r.rows[0]!.id;
  });
}

describe("estrutura e perfis", () => {
  it("primeiro usuario e admin; demais entram como leitura", async () => {
    const r = await q<{ id: string; role: string }>("select id, role from public.profiles");
    const byId = Object.fromEntries(r.rows.map((x) => [x.id, x.role]));
    expect(byId[admin]).toBe("admin");
    expect(byId[leitura]).toBe("leitura");
  });
  it("modelos iniciais nascem como rascunho", async () => {
    const r = await q<{ key: string; status: string }>("select key, status from public.document_templates");
    expect(r.rows).toHaveLength(5);
    expect(r.rows.every((x) => x.status === "draft")).toBe(true);
  });
  it("integracoes preparadas e desabilitadas", async () => {
    const r = await q<{ n: number }>("select count(*)::int n from public.integration_connections where not enabled");
    expect(r.rows[0]!.n).toBe(7);
  });
  it("nao permite remover o ultimo admin", async () => {
    const msg = await expectError(q("update public.profiles set role='leitura' where id=$1", [admin]));
    expect(msg).toContain("ao menos um administrador");
  });
  it("valida CNPJ no banco", async () => {
    const r = await q<{ a: boolean; b: boolean; c: boolean }>(
      `select public.is_valid_cnpj('${CNPJ_A}') a, public.is_valid_cnpj('${CNPJ_B}') b,
              public.is_valid_cnpj('11222333000180') c`,
    );
    expect(r.rows[0]).toEqual({ a: true, b: true, c: false });
  });
});

describe("clientes: seguranca e integridade", () => {
  it("anonimo nao acessa dados", async () => {
    const msg = await expectError(asUser(db, null, () => q("select * from public.clients")));
    expect(msg).toContain("permission denied");
  });
  it("usuario inativo nao ve nem cria nada", async () => {
    const id = await insertClient(admin, CNPJ_A);
    const rows = await asUser(db, inativo, () => q("select id from public.clients"));
    expect(rows.rows).toHaveLength(0);
    const msg = await expectError(insertClient(inativo, CNPJ_B));
    expect(msg).toContain("row-level security");
    expect(id).toBeTruthy();
  });
  it("leitura consulta mas nao grava", async () => {
    const rows = await asUser(db, leitura, () => q("select id from public.clients"));
    expect(rows.rows.length).toBeGreaterThan(0);
    const msg = await expectError(insertClient(leitura, CNPJ_B));
    expect(msg).toContain("row-level security");
  });
  it("rejeita CNPJ invalido e duplicado", async () => {
    expect(await expectError(insertClient(comercial, "11222333000199"))).toContain("check constraint");
    expect(await expectError(insertClient(admin, CNPJ_A, "Outra razao"))).toContain("clients_cnpj_key");
  });
  it("comercial cadastra, edita e a auditoria registra o historico", async () => {
    const id = await insertClient(comercial, CNPJ_B, "Alfa Industria LTDA");
    await asUser(db, comercial, () =>
      q("update public.clients set nome_fantasia='Alfa', cidade='Curitiba', uf='PR', updated_by=$2 where id=$1", [id, comercial]),
    );
    const log = await asUser(db, comercial, () =>
      q<{ action: string; changed_fields: string[]; user_email: string }>(
        "select action, changed_fields, user_email from public.audit_log where context_id=$1 order by id",
        [id],
      ),
    );
    expect(log.rows.map((r) => r.action)).toEqual(["INSERT", "UPDATE"]);
    expect(log.rows[1]!.changed_fields).toEqual(["cidade", "nome_fantasia", "uf", "updated_by"].sort());
    expect(log.rows[1]!.user_email).toBe("vendas@superseg.com.br");
  });
  it("nao ha DELETE de clientes", async () => {
    const msg = await expectError(asUser(db, admin, () => q("delete from public.clients")));
    expect(msg).toContain("permission denied");
  });
  it("auditoria nao pode ser alterada", async () => {
    const msg = await expectError(asUser(db, admin, () => q("update public.audit_log set action='INSERT'")));
    expect(msg).toContain("permission denied");
  });
});

describe("catalogo e modelos", () => {
  it("somente admin altera servicos", async () => {
    const sql = `insert into public.services (code, name, suggested_price_cents) values ('TESTE','Servico de teste', 150000)`;
    expect(await expectError(asUser(db, comercial, () => q(sql)))).toContain("row-level security");
    await asUser(db, admin, () => q(sql));
    const r = await asUser(db, comercial, () => q("select code from public.services where code='TESTE'"));
    expect(r.rows).toHaveLength(1);
  });
  it("aprovacao de modelo: so admin, imutavel e uma versao vigente por chave", async () => {
    const t = await q<{ id: string }>("select id from public.document_templates where key='formas_aceite'");
    const id = t.rows[0]!.id;
    const denied = await asUser(db, comercial, () => q("update public.document_templates set status='approved' where id=$1", [id]));
    expect(denied.affectedRows).toBe(0);
    await asUser(db, admin, () => q("update public.document_templates set status='approved' where id=$1", [id]));
    const a = await q<{ approved_by: string; approved_at: string }>("select approved_by, approved_at from public.document_templates where id=$1", [id]);
    expect(a.rows[0]!.approved_by).toBe(admin);
    expect(a.rows[0]!.approved_at).toBeTruthy();
    expect(await expectError(asUser(db, admin, () => q("update public.document_templates set body='alterado' where id=$1", [id])))).toContain("Crie uma nova versão");
    await asUser(db, admin, () => q(
      "insert into public.document_templates (key, kind, title, body, version) values ('formas_aceite','contractual','Formas de aceite','novo texto',2)"));
    const v2 = await q<{ id: string }>("select id from public.document_templates where key='formas_aceite' and version=2");
    await asUser(db, admin, () => q("update public.document_templates set status='approved' where id=$1", [v2.rows[0]!.id]));
    const s = await q<{ version: number; status: string }>("select version, status from public.document_templates where key='formas_aceite' order by version");
    expect(s.rows).toEqual([{ version: 1, status: "archived" }, { version: 2, status: "approved" }]);
  });
  it("admin nao cria modelo ja aprovado (precisa passar por aprovacao)", async () => {
    const msg = await expectError(asUser(db, admin, () => q(
      "insert into public.document_templates (key, kind, title, body, version, status) values ('x','contractual','x','x',1,'approved')")));
    expect(msg).toContain("row-level security");
  });
});

describe("orcamentos", () => {
  let clientId: string;
  let quoteId: string;

  beforeAll(async () => {
    const r = await q<{ id: string }>("select id from public.clients where cnpj=$1", [CNPJ_A]);
    clientId = r.rows[0]!.id;
  });

  const addItem = (user: string, qid: string, qty: number, price: number, disc: number) =>
    asUser(db, user, () =>
      q("insert into public.quote_items (quote_id, code, name, quantity, unit_price_cents, discount_percent) values ($1,'PGR','PGR',$2,$3,$4)", [qid, qty, price, disc]),
    );

  it("cria orcamento e recalcula totais automaticamente", async () => {
    quoteId = await asUser(db, comercial, async () => {
      const r = await q<{ id: string }>(
        "insert into public.quotes (client_id, subject, validity_date, created_by) values ($1,'PGR e PCMSO', public.today_br() + 15, $2) returning id",
        [clientId, comercial],
      );
      return r.rows[0]!.id;
    });
    await addItem(comercial, quoteId, 1, 150000, 0);
    await addItem(comercial, quoteId, 10, 4990, 5);
    const r = await q<{ subtotal_cents: string; discount_cents: string; total_cents: string }>(
      "select subtotal_cents, discount_cents, total_cents from public.quotes where id=$1", [quoteId]);
    const item2 = calcItem({ quantity: 10, unitPriceCents: 4990, discountPercent: 5 });
    expect(Number(r.rows[0]!.subtotal_cents)).toBe(150000 + 49900);
    expect(Number(r.rows[0]!.total_cents)).toBe(150000 + item2.totalCents);
    expect(Number(r.rows[0]!.discount_cents)).toBe(49900 - item2.totalCents);
  });

  it("calculo do banco e identico ao da aplicacao", async () => {
    const cases: [number, number, number][] = [[1, 999, 5], [1, 10, 5], [2.5, 12345, 12.5], [0.33, 777, 7.77], [100, 1, 0.5], [3, 33333, 33.33]];
    for (const [qty, price, disc] of cases) {
      await addItem(admin, quoteId, qty, price, disc);
      const r = await q<{ total_cents: string }>(
        "select total_cents from public.quote_items where quote_id=$1 order by created_at desc, id desc limit 1", [quoteId]);
      expect(Number(r.rows[0]!.total_cents), `${qty}x${price} -${disc}%`).toBe(calcItem({ quantity: qty, unitPriceCents: price, discountPercent: disc }).totalCents);
    }
    await asUser(db, admin, () => q("delete from public.quote_items where quote_id=$1 and (unit_price_cents <> 150000 and unit_price_cents <> 4990)", [quoteId]));
  });

  it("desconto acima do limite exige administrador", async () => {
    expect(await expectError(addItem(comercial, quoteId, 1, 1000, 6))).toContain("acima do limite autorizado");
    await addItem(comercial, quoteId, 1, 1000, 5);
    await addItem(admin, quoteId, 1, 1000, 20);
    await asUser(db, admin, () => q("delete from public.quote_items where quote_id=$1 and unit_price_cents=1000", [quoteId]));
  });

  it("leitura nao cria orcamento", async () => {
    const msg = await expectError(asUser(db, leitura, () => q(
      "insert into public.quotes (client_id, validity_date) values ($1, public.today_br())", [clientId])));
    expect(msg).toContain("row-level security");
  });

  it("envia, trava edicao e valida transicoes", async () => {
    await asUser(db, comercial, () => q("update public.quotes set status='enviada' where id=$1", [quoteId]));
    const s = await q<{ sent_at: string }>("select sent_at from public.quotes where id=$1", [quoteId]);
    expect(s.rows[0]!.sent_at).toBeTruthy();
    expect(await expectError(addItem(comercial, quoteId, 1, 100, 0))).toContain("nova versão");
    expect(await expectError(asUser(db, comercial, () => q("update public.quotes set payment_terms='x' where id=$1", [quoteId])))).toContain("nova versão");
    expect(await expectError(asUser(db, comercial, () => q("update public.quotes set status='elaboracao' where id=$1", [quoteId])))).toContain("Transição");
  });

  it("nao envia orcamento sem valor", async () => {
    const id = await asUser(db, comercial, async () => (await q<{ id: string }>(
      "insert into public.quotes (client_id, validity_date) values ($1, public.today_br()+5) returning id", [clientId])).rows[0]!.id);
    expect(await expectError(asUser(db, comercial, () => q("update public.quotes set status='enviada' where id=$1", [id])))).toContain("sem itens");
  });

  it("cria nova versao copiando itens", async () => {
    const r = await asUser(db, comercial, () => q<{ v: string }>("select public.quote_new_version($1) v", [quoteId]));
    const newId = r.rows[0]!.v;
    const quotes = await q<{ number: number; version: number; is_current: boolean; status: string; total_cents: string }>(
      "select number, version, is_current, status, total_cents from public.quotes where number=(select number from public.quotes where id=$1) order by version", [quoteId]);
    expect(quotes.rows.map((x) => [x.version, x.is_current, x.status])).toEqual([[1, false, "enviada"], [2, true, "elaboracao"]]);
    expect(quotes.rows[1]!.total_cents).toBe(quotes.rows[0]!.total_cents);
    const items = await q<{ n: number }>("select count(*)::int n from public.quote_items where quote_id=$1", [newId]);
    expect(items.rows[0]!.n).toBe(2);
    await asUser(db, comercial, () => q("delete from public.quote_items where quote_id=$1 and unit_price_cents=4990", [newId]));
    await asUser(db, comercial, () => q("update public.quotes set status='enviada' where id=$1", [newId]));
    await asUser(db, comercial, () => q("update public.quotes set status='aprovada' where id=$1", [newId]));
  });

  it("painel comercial conta propostas por situacao (vencida derivada)", async () => {
    const mk = async (status: string, offsetDays: number) => {
      const id = await asUser(db, comercial, async () => (await q<{ id: string }>(
        "insert into public.quotes (client_id, validity_date) values ($1, public.today_br() + $2::int) returning id", [clientId, offsetDays])).rows[0]!.id);
      await addItem(comercial, id, 1, 10000, 0);
      if (status !== "elaboracao") await asUser(db, comercial, () => q("update public.quotes set status='enviada' where id=$1", [id]));
      if (status === "aprovada" || status === "recusada") await asUser(db, comercial, () => q("update public.quotes set status=$2 where id=$1", [id, status]));
    };
    await mk("elaboracao", 10);
    await mk("enviada", 10);
    await mk("enviada", -3);
    await mk("recusada", 10);
    const r = await asUser(db, leitura, () => q<{ d: Record<string, number> }>("select public.commercial_dashboard() d"));
    expect(r.rows[0]!.d).toMatchObject({ clients: 2, elaboracao: 2, enviadas: 1, aprovadas: 1, recusadas: 1, vencidas: 1 });
  });

  it("gera eventos na fila de integracoes, visiveis somente ao admin", async () => {
    const asAdmin = await asUser(db, admin, () => q<{ n: number }>("select count(*)::int n from public.integration_outbox"));
    expect(asAdmin.rows[0]!.n).toBeGreaterThan(0);
    const asCom = await asUser(db, comercial, () => q<{ n: number }>("select count(*)::int n from public.integration_outbox"));
    expect(asCom.rows[0]!.n).toBe(0);
  });

  it("comercial nao enxerga perfis de outros usuarios nem logs administrativos", async () => {
    const p = await asUser(db, comercial, () => q("select id from public.profiles"));
    expect(p.rows).toHaveLength(1);
    const a = await asUser(db, comercial, () => q("select distinct table_name from public.audit_log"));
    expect(a.rows.map((x) => (x as { table_name: string }).table_name)).not.toContain("profiles");
  });
});

describe("gravacao atomica de orcamentos (save_quote)", () => {
  let clientId: string;
  const header = (over: Record<string, unknown> = {}) => ({
    client_id: clientId, unit_id: null, contact_id: null, subject: "Teste", validity_date: "2030-01-01",
    delivery_days: 10, payment_terms: "30 dias", internal_notes: "", ...over,
  });
  const item = (over: Record<string, unknown> = {}) => ({
    service_id: null, code: "PGR", name: "PGR", quantity: 2, unit_price_cents: 10000, discount_percent: 0, ...over,
  });
  const save = (user: string, id: string | null, h: object, items: object[]) =>
    asUser(db, user, async () => (await q<{ id: string }>("select public.save_quote($1, $2::jsonb, $3::jsonb) id", [id, JSON.stringify(h), JSON.stringify(items)])).rows[0]!.id);

  beforeAll(async () => {
    clientId = (await q<{ id: string }>("select id from public.clients where cnpj=$1", [CNPJ_A])).rows[0]!.id;
  });

  it("cria e edita substituindo os itens de forma atomica", async () => {
    const id = await save(comercial, null, header(), [item(), item({ code: "PCMSO", name: "PCMSO", quantity: 1 })]);
    let r = await q<{ total_cents: string }>("select total_cents from public.quotes where id=$1", [id]);
    expect(Number(r.rows[0]!.total_cents)).toBe(30000);
    await save(comercial, id, header({ subject: "Editado" }), [item({ quantity: 1 })]);
    r = await q("select total_cents from public.quotes where id=$1", [id]);
    expect(Number(r.rows[0]!.total_cents)).toBe(10000);
    const n = await q<{ n: number }>("select count(*)::int n from public.quote_items where quote_id=$1", [id]);
    expect(n.rows[0]!.n).toBe(1);
  });

  it("falha por inteiro (nada e gravado) se um item viola o limite de desconto", async () => {
    const id = await save(comercial, null, header(), [item()]);
    const msg = await expectError(save(comercial, id, header({ subject: "NAO DEVE GRAVAR" }), [item({ quantity: 9 }), item({ discount_percent: 50 })]));
    expect(msg).toContain("acima do limite");
    const r = await q<{ subject: string; total_cents: string }>("select subject, total_cents from public.quotes where id=$1", [id]);
    expect({ ...r.rows[0], total_cents: Number(r.rows[0]!.total_cents) }).toEqual({ subject: "Teste", total_cents: 20000 });
  });

  it("valida cliente inativo, unidade de outro cliente e orcamento ja enviado", async () => {
    const other = await insertClient(admin, "45997418000153", "Outra Empresa SA");
    const unit = (await q<{ id: string }>("insert into public.client_units (client_id, name) values ($1,'Filial') returning id", [other])).rows[0]!.id;
    expect(await expectError(save(comercial, null, header({ unit_id: unit }), [item()]))).toContain("não pertence ao cliente");
    await q("update public.clients set active=false where id=$1", [other]);
    expect(await expectError(save(comercial, null, header({ client_id: other }), [item()]))).toContain("inativo");
    const id = await save(comercial, null, header(), [item()]);
    await asUser(db, comercial, () => q("update public.quotes set status='enviada' where id=$1", [id]));
    expect(await expectError(save(comercial, id, header(), [item()]))).toContain("nova versão");
  });

  it("leitura nao grava", async () => {
    expect(await expectError(save(leitura, null, header(), [item()]))).toContain("row-level security");
  });
});

describe("catalogo inicial", () => {
  it("traz os servicos de SST com preco zerado para definicao pela diretoria", async () => {
    const r = await q<{ code: string; suggested_price_cents: string }>("select code, suggested_price_cents from public.services where code in ('PCMSO','LTCAT','NR12','NR13','ERGO','TREIN','EXAMES','OUTROS')");
    expect(r.rows).toHaveLength(8);
    expect(r.rows.every((x) => Number(x.suggested_price_cents) === 0)).toBe(true);
  });
});
